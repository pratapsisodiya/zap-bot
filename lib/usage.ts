import { APPWRITE_IDS } from "./appwrite-config"
import { databases, Query } from "./appwrite.server"

interface PlanLimits {
    meetings: number
    chatMessages: number
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
    free: { meetings: 3, chatMessages: 10 },
    starter: { meetings: 10, chatMessages: 30 },
    pro: { meetings: 30, chatMessages: 100 },
    premium: { meetings: -1, chatMessages: -1 }
}

type AppwriteDocumentList = { documents: any[] };

export async function canUserSendBot(userId: string) {
    const user = await databases
        .listDocuments(APPWRITE_IDS.databaseId, APPWRITE_IDS.usersCollectionId, [
            Query.equal("clerkId", userId),
            Query.limit(1),
        ])
        .then((res: AppwriteDocumentList) => res.documents[0] as any)

    if (!user) {
        return { allowed: false, reason: 'User not found' }
    }

    if (user.subscriptionStatus === 'expired') {
        return { allowed: false, reason: 'Your subscription has expired. Please renew to continue.' }
    }

    const plan = user.currentPlan || "free"
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS["free"]!

    const meetingsCount = user.meetingsThisMonth || 0
    if (limits.meetings !== -1 && meetingsCount >= limits.meetings) {
        return { allowed: false, reason: `You've reached your monthly limit of ${limits.meetings} meetings` }
    }

    return { allowed: true }
}

export async function canUserChat(userId: string) {
    const user = await databases
        .listDocuments(APPWRITE_IDS.databaseId, APPWRITE_IDS.usersCollectionId, [
            Query.equal("clerkId", userId),
            Query.limit(1),
        ])
        .then((res: AppwriteDocumentList) => res.documents[0] as any)

    if (!user) {
        return { allowed: false, reason: 'user not found' }
    }

    if (user.subscriptionStatus === 'expired') {
        return { allowed: false, reason: 'Your subscription has expired. Please renew to continue chat.' }
    }

    const plan = user.currentPlan || "free"
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS["free"]!

    const chatCount = user.chatMessagesToday || 0
    if (limits.chatMessages !== -1 && chatCount >= limits.chatMessages) {
        return { allowed: false, reason: `you've reached your daily limit of ${limits.chatMessages} messages` }
    }

    return { allowed: true }
}

export async function incrementMeetingUsage(userId: string) {
    const user = await databases
        .listDocuments(APPWRITE_IDS.databaseId, APPWRITE_IDS.usersCollectionId, [
            Query.equal("clerkId", userId),
            Query.limit(1),
        ])
        .then((res: AppwriteDocumentList) => res.documents[0] as any)

    if (!user) return

    await databases.updateDocument(
        APPWRITE_IDS.databaseId,
        APPWRITE_IDS.usersCollectionId,
        user.$id,
        {
            meetingsThisMonth: (user.meetingsThisMonth || 0) + 1,
        }
    )
}

export async function incrementChatUsage(userId: string) {
    const user = await databases
        .listDocuments(APPWRITE_IDS.databaseId, APPWRITE_IDS.usersCollectionId, [
            Query.equal("clerkId", userId),
            Query.limit(1),
        ])
        .then((res: AppwriteDocumentList) => res.documents[0] as any)

    if (!user) return

    await databases.updateDocument(
        APPWRITE_IDS.databaseId,
        APPWRITE_IDS.usersCollectionId,
        user.$id,
        {
            chatMessagesToday: (user.chatMessagesToday || 0) + 1,
        }
    )
}

export function getPlanLimits(plan: string): PlanLimits {
    const limits = PLAN_LIMITS[plan]
    return limits ?? PLAN_LIMITS.free!
}
