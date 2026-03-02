import { Auction } from "../types";

const SELLER_FAULT_REASONS = ["SELLER_NO_SHOW", "SELLER_NOT_READY"];
const BUYER_FAULT_REASONS = [
    "BUYER_NO_SHOW",
    "BUYER_REFUSED",
    "BUYER_DID_NOT_RECEIVE",
    "BUYER_UNREACHABLE",
    "WRONG_ADDRESS",
];

const normalizeId = (val: any) => {
    if (!val) return null;
    if (typeof val === "string") return val;
    if (val._id) return val._id.toString();
    return val.toString();
};

export const canUserRate = (
    auction: Auction | null | undefined,
    fromId: string | undefined | null
): boolean => {
    if (!auction || !fromId) return false;

    const status = String(auction.status || "").toLowerCase();
    const winnerId = normalizeId(auction.winner);
    const ownerId = normalizeId(auction.owner);

    const isWinner = fromId === winnerId;
    const isOwner = fromId === ownerId;

    if (!isWinner && !isOwner) return false;

    const resolvedStatuses = [
        "completed",
        "cancelled_by_winner",
        "cancelled_by_seller",
        "cancelled_by_both",
    ];

    if (!resolvedStatuses.includes(status)) return false;

    if (status === "completed") return true;

    if (status === "cancelled_by_both") return false;

    if (status === "cancelled_by_winner") return isOwner;

    if (status === "cancelled_by_seller") return isWinner;

    // @ts-ignore
    const failureReason = auction.deliveryPenaltyReason || auction.deliveryOrder?.failureReason || "";

    if (failureReason) {
        if (SELLER_FAULT_REASONS.includes(failureReason)) {
            return isWinner;
        }

        if (BUYER_FAULT_REASONS.includes(failureReason)) {
            return isOwner;
        }
    }

    // Default fallback if resolved but no reason
    return true;
};
