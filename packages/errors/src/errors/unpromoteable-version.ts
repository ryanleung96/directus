import { createError, ErrorCode } from "../index.js";

export interface UnpromoteableVersionErrorExtensions {
	reason: string;
}

const messageConstructor = (extendsions: UnpromoteableVersionErrorExtensions) =>
	`Can't promote version. ${extendsions.reason}.`;

export const UnpromoteableVersionError = createError<UnpromoteableVersionErrorExtensions>(
	ErrorCode.UnpromoteableVersion,
	messageConstructor,
	403,
);
