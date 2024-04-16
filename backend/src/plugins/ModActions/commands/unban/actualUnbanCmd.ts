import { Attachment, ChatInputCommandInteraction, GuildMember, Message, Snowflake, User } from "discord.js";
import { GuildPluginData } from "knub";
import { CaseTypes } from "../../../../data/CaseTypes";
import { LogType } from "../../../../data/LogType";
import { clearExpiringTempban } from "../../../../data/loops/expiringTempbansLoop";
import { UnknownUser } from "../../../../utils";
import { CasesPlugin } from "../../../Cases/CasesPlugin";
import { LogsPlugin } from "../../../Logs/LogsPlugin";
import { IgnoredEventType, ModActionsPluginType } from "../../types";
import { handleAttachmentLinkDetectionAndGetRestriction } from "../../functions/attachmentLinkReaction";
import { formatReasonWithMessageLinkForAttachments } from "../../functions/formatReasonForAttachments";
import { ignoreEvent } from "../../functions/ignoreEvent";

export async function actualUnbanCmd(
  pluginData: GuildPluginData<ModActionsPluginType>,
  context: Message | ChatInputCommandInteraction,
  authorId: string,
  user: User | UnknownUser,
  reason: string,
  attachments: Array<Attachment>,
  mod: GuildMember,
) {
  if (await handleAttachmentLinkDetectionAndGetRestriction(pluginData, context, reason)) {
    return;
  }

  pluginData.state.serverLogs.ignoreLog(LogType.MEMBER_UNBAN, user.id);
  const formattedReason = await formatReasonWithMessageLinkForAttachments(pluginData, reason, context, attachments);

  try {
    ignoreEvent(pluginData, IgnoredEventType.Unban, user.id);
    await pluginData.guild.bans.remove(user.id as Snowflake, formattedReason ?? undefined);
  } catch {
    pluginData.state.common.sendErrorMessage(
      context,
      "Failed to unban member; are you sure they're banned?"
    );
    return;
  }

  // Create a case
  const casesPlugin = pluginData.getPlugin(CasesPlugin);
  const createdCase = await casesPlugin.createCase({
    userId: user.id,
    modId: mod.id,
    type: CaseTypes.Unban,
    reason: formattedReason,
    ppId: mod.id !== authorId ? authorId : undefined,
  });

  // Delete the tempban, if one exists
  const tempban = await pluginData.state.tempbans.findExistingTempbanForUserId(user.id);
  if (tempban) {
    clearExpiringTempban(tempban);
    await pluginData.state.tempbans.clear(user.id);
  }

  // Confirm the action
  pluginData.state.common.sendSuccessMessage(context, `Member unbanned (Case #${createdCase.case_number})`);

  // Log the action
  pluginData.getPlugin(LogsPlugin).logMemberUnban({
    mod: mod.user,
    userId: user.id,
    caseNumber: createdCase.case_number,
    reason: formattedReason ?? "",
  });

  pluginData.state.events.emit("unban", user.id);
}
