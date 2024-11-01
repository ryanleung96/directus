<script setup lang="ts">
import api from '@/api';
import { useFieldsStore } from '@/stores/fields';
import { unexpectedError } from '@/utils/unexpected-error';
import { ContentVersion, Field } from '@directus/types';
import { isNil } from 'lodash';
import { computed, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import VersionPromoteField from './version-promote-field.vue';

type Comparison = {
	outdated: boolean;
	mainHash: string;
	current: Record<string, any>;
	main: Record<string, any>;
};

interface Props {
	active: boolean;
	currentVersion: ContentVersion;
}

const { t } = useI18n();

const fieldsStore = useFieldsStore();

const props = defineProps<Props>();

const { active, currentVersion } = toRefs(props);

const selectedFields = ref<string[]>([]);

const comparedData = ref<Comparison | null>(null);

const loading = ref(false);

const { tabs, currentTab } = useTab();

const { rejectReasonDialogActive, apiLoading, onActionBtnClicked, rejectVersion } = useActionDialog();

const emit = defineEmits<{
	cancel: [];
	reviewdone: [approved: boolean];
}>();

const currentVersionDisplayName = computed(() =>
	isNil(currentVersion.value.name) ? currentVersion.value.key : currentVersion.value.name,
);

const comparedFields = computed<Field[]>(() => {
	if (comparedData.value === null) return [];

	return Object.keys(comparedData.value.current)
		.map((fieldKey) => fieldsStore.getField(unref(currentVersion).collection, fieldKey))
		.filter((field) => !!field && !isPrimaryKey(field)) as Field[];

	function isPrimaryKey(field: Field) {
		return (
			field.schema?.is_primary_key === true &&
			(field.schema?.has_auto_increment === true || field.meta?.special?.includes('uuid'))
		);
	}
});

const previewData = computed(() => {
	if (!comparedData.value) return null;

	const data: Record<string, any> = {};

	for (const fieldKey of Object.keys(comparedData.value.main)) {
		data[fieldKey] = selectedFields.value.includes(fieldKey)
			? comparedData.value.current[fieldKey]
			: comparedData.value.main[fieldKey];
	}

	return data;
});

const edits = ref<{ approved: number, reason: string }>({
	approved: 0, // remember to cast this to boolean when submitting to server
	reason: ''
});

watch(edits, (newVal) => {
	console.log(newVal);
});

watch(
	active,
	(value) => {
		if (value) getComparison();
	},
	{ immediate: true },
);

function addField(field: string) {
	selectedFields.value = [...selectedFields.value, field];
}

function removeField(field: string) {
	selectedFields.value = selectedFields.value.filter((f) => f !== field);
}

async function getComparison() {
	loading.value = true;

	try {
		const result: Comparison = await api
			.get(`/versions/${unref(currentVersion).id}/compare`)
			.then((res) => res.data.data);

		comparedData.value = result;

		const comparedFieldsKeys = comparedFields.value.map((field) => field.field);

		selectedFields.value = Object.keys(result.current).filter((fieldKey) => comparedFieldsKeys.includes(fieldKey));
	} catch (error) {
		unexpectedError(error);
	} finally {
		loading.value = false;
	}
}

function useActionDialog() {
	const rejectReasonDialogActive = ref(false);
	const apiLoading = ref(false);


	function onActionBtnClicked(action: string) {
		if (action === 'approve') {
			approveOrRejectReview({ approved: 1 });
		} else if (action === 'reject') {
			rejectReasonDialogActive.value = true;
			// need to ask for reason
		}
	}

	function rejectVersion(reason: string) {
		rejectReasonDialogActive.value = false;
		approveOrRejectReview({ approved: 0, reason: reason });
	}

	async function approveOrRejectReview(result: { approved: number, reason?: string }) {
		if (!currentVersion.value) return;

		const castedResult = {
			approved: result.approved === 1,
			reason: result.reason || null
		};

		apiLoading.value = true;

		try {
			await api.post(`/versions/${unref(currentVersion).id}/approve-review`, castedResult);

			rejectReasonDialogActive.value = false;

			emit('reviewdone', castedResult.approved);
		} catch (error) {
			unexpectedError(error);
			throw error;
		} finally {
			apiLoading.value = true;
		}
	}

	return { rejectReasonDialogActive, apiLoading, onActionBtnClicked, rejectVersion };
}


function useTab() {
	const tabs = [
		{
			text: t('promote_version_changes'),
			value: 'changes',
		},
		{
			text: t('promote_version_preview'),
			value: 'preview',
		},
	];

	const currentTab = ref([tabs[0]!.value]);

	return { tabs, currentTab };
}
</script>

<template>
	<v-drawer
		:title="t('approve_version_drawer_title', { version: currentVersionDisplayName })"
		class="version-drawer"
		persistent
		:model-value="active"
		@cancel="$emit('cancel')"
		@esc="$emit('cancel')"
	>
		<template #sidebar>
			<v-tabs v-model="currentTab" vertical>
				<v-tab v-for="tab in tabs" :key="tab.value" :value="tab.value">
					{{ tab.text }}
				</v-tab>
			</v-tabs>
		</template>

		<div class="content">
			<div v-if="currentTab[0] === 'changes'" class="grid">
				<div v-for="field in comparedFields" :key="field.field" class="field full">
					<div class="type-label">
						{{ field.name }}
					</div>
					<div
						class="compare main"
						:class="{ active: !selectedFields.includes(field.field) }"
						@click="removeField(field.field)"
					>
						<v-icon name="looks_one" />
						<version-promote-field class="field-content" :value="comparedData?.main[field.field]" />
						<v-chip class="version" x-small>{{ t('main_version') }}</v-chip>
						<v-icon :name="!selectedFields.includes(field.field) ? 'check' : 'close'" />
					</div>
					<div
						class="compare current"
						:class="{ active: selectedFields.includes(field.field) }"
						@click="addField(field.field)"
					>
						<v-icon name="looks_two" />
						<version-promote-field class="field-content" :value="comparedData?.current[field.field]" />
						<v-chip class="version" x-small>{{ currentVersionDisplayName }}</v-chip>
						<v-icon :name="selectedFields.includes(field.field) ? 'check' : 'close'" />
					</div>
				</div>
			</div>
			<div v-if="currentTab[0] === 'preview'">
				<v-form
					disabled
					:collection="currentVersion.collection"
					:primary-key="currentVersion.item"
					:initial-values="previewData"
				/>
			</div>
		</div>

		<v-dialog v-model="rejectReasonDialogActive" @esc="rejectReasonDialogActive = false">
			<v-card>
				<v-card-title>
					{{ t('reject_version_reason_dialog_title', { version: currentVersionDisplayName }) }}
				</v-card-title>
				<v-card-text>
					{{ t('reject_version_reason_dialog_content') }}
					<v-input v-model="edits.reason" :placeholder="t('reject_version_reason_dialog_content')" />
				</v-card-text>
				<v-card-actions>
					<v-button secondary @click="rejectReasonDialogActive = false">{{ t('cancel') }}</v-button>
					<v-button :loading="apiLoading" kind="danger" @click="rejectVersion(edits.reason)">
						Reject
					</v-button>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<template #actions>
			<v-button
				tooltip="Approve this Version"
				:disabled="apiLoading"
				icon
				rounded
				kind="success"
				:loading="apiLoading"
				@click="onActionBtnClicked('approve')"
			>
				<v-icon name="check" />
			</v-button>

			<v-button
				tooltip="Reject this Version"
				:disabled="apiLoading"
				icon
				rounded
				kind="danger"
				:loading="apiLoading"
				@click="onActionBtnClicked('reject')"
			>
				<v-icon name="cancel" />
			</v-button>
		</template>

	</v-drawer>
</template>

<style lang="scss" scoped>
@import '@/styles/mixins/form-grid';

.content {
	padding: var(--content-padding);
	padding-top: 0;
	padding-bottom: var(--content-padding-bottom);

	.grid {
		@include form-grid;
	}
}

.compare {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 8px;
	gap: 8px;
	color: var(--theme--foreground-subdued);
	background-color: var(--theme--background-subdued);
	cursor: pointer;

	.field-content {
		flex-grow: 1;
	}

	.version {
		text-transform: uppercase;
	}

	&.main {
		border-radius: var(--theme--border-radius) var(--theme--border-radius) 0 0;
		&.active {
			color: var(--theme--secondary);
			background-color: var(--secondary-alt);

			.version {
				color: var(--theme--secondary);
				border-color: var(--theme--secondary);
				background-color: var(--secondary-25);
			}
		}
	}

	&.current {
		border-radius: 0 0 var(--theme--border-radius) var(--theme--border-radius);
		&.active {
			color: var(--theme--primary);
			background-color: var(--theme--primary-background);

			.version {
				color: var(--theme--primary);
				border-color: var(--theme--primary);
				background-color: var(--theme--primary-subdued);
			}
		}
	}
}
</style>
