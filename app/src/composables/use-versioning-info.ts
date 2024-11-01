import { ContentVersion } from "@directus/types";
import { computed, ComputedRef } from "vue";

export type VersioningInfo = {
	isReviewing: ComputedRef<boolean>;
	isReviewed: ComputedRef<boolean>;
	isApproved: ComputedRef<boolean>;
	isRejected: ComputedRef<boolean>;
	rejectedReason: ComputedRef<string>;
}

export function useVersioningInfo(version: ContentVersion | null) : VersioningInfo {
	if (version === null) {
		return {
			isReviewing: computed(() => false),
			isReviewed: computed(() => false),
			isApproved: computed(() => false),
			isRejected: computed(() => false),
			rejectedReason: computed(() => '')
		}
	}

	const isReviewing = computed(() => version.review_requested);
	const isReviewed = computed(() => version.reviewed);
	const isApproved = computed(() => version.approved);
	const isRejected = computed(() => !version.approved);
	const rejectedReason = computed(() => version.reject_reason ? version.reject_reason : '');

	return {
		isReviewing,
		isReviewed,
		isApproved,
		isRejected,
		rejectedReason
	}
}
