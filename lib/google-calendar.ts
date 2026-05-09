import { databases } from "./appwrite.server";
import { APPWRITE_IDS } from "./appwrite-config";
import { updateDocumentBestEffort } from "@/lib/appwrite-compat";

export interface GoogleCalendarEvent {
    id: string
    summary?: string
    description?: string
    start?: {
        dateTime?: string
        date?: string
    }
    end?: {
        dateTime?: string
        date?: string
    }
    attendees?: Array<{ email: string }>
    hangoutLink?: string
    conferenceData?: {
        entryPoints?: Array<{ uri: string }>
    }
    status?: string
}

export interface GoogleCalendarResponse {
    items?: GoogleCalendarEvent[]
}

export type UserWithTokens = {
    $id: string
    clerkId: string
    googleAccessToken: string | null
    googleRefreshToken: string | null
    googleTokenExpiry: string | Date | null
    calendarConnected: boolean
}

export async function refreshGoogleToken(user: UserWithTokens) {
    try {
        if (!user.googleRefreshToken) {
            console.error(`No refresh token for user ${user.$id}`)
            await updateDocumentBestEffort(
                APPWRITE_IDS.databaseId,
                APPWRITE_IDS.usersCollectionId,
                user.$id,
                {
                    calendarConnected: false,
                    googleAccessToken: null
                }
            )
            return null
        }

        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables')
            return null
        }

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: user.googleRefreshToken,
                grant_type: 'refresh_token'
            })
        })

        const tokens = await response.json()

        if (!tokens.access_token) {
            console.error(`Failed to get new access token for user ${user.$id}:`, tokens)
            if (tokens.error === 'invalid_grant' || tokens.error === 'unauthorized_client') {
                console.log(`Disconnecting calendar for user ${user.$id} due to ${tokens.error}`)
                await updateDocumentBestEffort(
                    APPWRITE_IDS.databaseId,
                    APPWRITE_IDS.usersCollectionId,
                    user.$id,
                    {
                        calendarConnected: false,
                        googleAccessToken: null,
                        googleRefreshToken: null
                    }
                )
            }
            return null
        }

        await updateDocumentBestEffort(
            APPWRITE_IDS.databaseId,
            APPWRITE_IDS.usersCollectionId,
            user.$id,
            {
                googleAccessToken: tokens.access_token,
                googleTokenExpiry: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString()
            }
        )
        return tokens.access_token
    } catch (error) {
        console.error(`Token refresh error for user ${user.clerkId}:`, error)
        return null
    }
}

export async function getValidAccessToken(user: UserWithTokens) {
    if (!user.googleAccessToken) {
        return null
    }

    const now = new Date()
    const tokenExpiry = user.googleTokenExpiry ? new Date(user.googleTokenExpiry) : null
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)

    if (tokenExpiry && tokenExpiry <= tenMinutesFromNow) {
        return await refreshGoogleToken(user)
    }

    return user.googleAccessToken
}

export async function fetchFromGoogleCalendar(
    user: UserWithTokens,
    timeMin: Date,
    timeMax: Date
): Promise<GoogleCalendarResponse | null> {
    try {
        const accessToken = await getValidAccessToken(user)
        if (!accessToken) {
            return null
        }

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            `timeMin=${timeMin.toISOString()}&` +
            `timeMax=${timeMax.toISOString()}&` +
            `singleEvents=true&orderBy=startTime&maxResults=50`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        if (!response.ok) {
            if (response.status === 401) {
                const refreshedToken = await refreshGoogleToken(user)
                if (!refreshedToken) {
                    return null
                }
                const retryResponse = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
                    `timeMin=${timeMin.toISOString()}&` +
                    `timeMax=${timeMax.toISOString()}&` +
                    `singleEvents=true&orderBy=startTime&maxResults=50`,
                    {
                        headers: {
                            'Authorization': `Bearer ${refreshedToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                )
                if (!retryResponse.ok) {
                    return null
                }
                return await retryResponse.json()
            }
            return null
        }

        return await response.json()
    } catch (error) {
        console.error('Error fetching from Google Calendar:', error)
        return null
    }
}
