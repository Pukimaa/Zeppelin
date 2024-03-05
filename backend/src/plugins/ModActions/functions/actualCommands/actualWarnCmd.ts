import { Attachment, ChatInputCommandInteraction, GuildMember, Message } from "discord.js";
import { GuildPluginData } from "knub";
import { CaseTypes } from "../../../../data/CaseTypes";
import { UserNotificationMethod, renderUsername } from "../../../../utils";
import { waitForButtonConfirm } from "../../../../utils/waitForInteraction";
import { CasesPlugin } from "../../../Cases/CasesPlugin";
import { CommonPlugin } from "../../../Common/CommonPlugin";
import { ModActionsPluginType } from "../../types";
import { handleAttachmentLinkDetectionAndGetRestriction } from "../attachmentLinkReaction";
import { formatReasonWithAttachments, formatReasonWithMessageLinkForAttachments } from "../formatReasonForAttachments";
import { parseReason } from "../parseReason";
import { warnMember } from "../warnMember";

export async function actualWarnCmd(
  pluginData: GuildPluginData<ModActionsPluginType>,
  context: Message | ChatInputCommandInteraction,
  authorId: string,
  mod: GuildMember,
  memberToWarn: GuildMember,
  reason: string,
  attachments: Attachment[],
  contactMethods?: UserNotificationMethod[],
) {
  reason = parseReason(pluginData.config.get(), reason);
  if (await handleAttachmentLinkDetectionAndGetRestriction(pluginData, context, reason)) {
    return;
  }

  const config = pluginData.config.get();
  const formattedReason = await formatReasonWithMessageLinkForAttachments(pluginData, reason, context, attachments);
  const formattedReasonWithAttachments = formatReasonWithAttachments(reason, attachments);

  const casesPlugin = pluginData.getPlugin(CasesPlugin);
  const priorWarnAmount = await casesPlugin.getCaseTypeAmountForUserId(memberToWarn.id, CaseTypes.Warn);
  if (config.warn_notify_enabled && priorWarnAmount >= config.warn_notify_threshold) {
    const reply = await waitForButtonConfirm(
      context,
      { content: config.warn_notify_message.replace("{priorWarnings}", `${priorWarnAmount}`) },
      { confirmText: "Yes", cancelText: "No", restrictToId: authorId },
    );
    if (!reply) {
      await pluginData.getPlugin(CommonPlugin).sendErrorMessage(context, "Warn cancelled by moderator");
      return;
    }
  }

  const warnResult = await warnMember(pluginData, memberToWarn, formattedReason, formattedReasonWithAttachments, {
    contactMethods,
    caseArgs: {
      modId: mod.id,
      ppId: mod.id !== authorId ? authorId : undefined,
      reason: formattedReason,
    },
    retryPromptContext: context,
  });

  if (warnResult.status === "failed") {
    const failReason = warnResult.error ? `: ${warnResult.error}` : "";

    await pluginData.getPlugin(CommonPlugin).sendErrorMessage(context, `Failed to warn user${failReason}`);

    return;
  }

  const messageResultText = warnResult.notifyResult.text ? ` (${warnResult.notifyResult.text})` : "";

  await pluginData
    .getPlugin(CommonPlugin)
    .sendSuccessMessage(
      context,
      `Warned **${renderUsername(memberToWarn.user)}** (Case #${warnResult.case.case_number})${messageResultText}`,
    );
}
