import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_versions', (table) => {
		table.boolean('review_requested').defaultTo(false).notNullable();
		table.boolean('reviewed').defaultTo(false).notNullable();
		table.boolean('approved').defaultTo(false).notNullable();
		table.string('reject_reason', 255).nullable();
	});

	await knex.schema.alterTable('directus_collections', (table) => {
		table.boolean('versioning_restrictions').defaultTo(false).notNullable();
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.alterTable('directus_versions', (table) => {
		// Drop the field from the table
		table.dropColumns('review_requested', 'reviewed', 'approved', 'reject_reason');
	});

	await knex.schema.alterTable('directus_collections', (table) => {
		table.dropColumn('versioning_restrictions');
	});
}
