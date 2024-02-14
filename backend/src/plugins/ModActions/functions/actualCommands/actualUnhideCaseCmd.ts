import { ChatInputCommandInteraction, TextBasedChannel } from "discord.js";
import { GuildPluginData } from "knub";
import { sendErrorMessage, sendSuccessMessage } from "../../../../pluginUtils";
import { ModActionsPluginType } from "../../types";

export async function actualUnhideCaseCmd(
  pluginData: GuildPluginData<ModActionsPluginType>,
  context: TextBasedChannel | ChatInputCommandInteraction,
  caseNumbers: number[],
) {
  const failed: number[] = [];

  for (const num of caseNumbers) {
    const theCase = await pluginData.state.cases.findByCaseNumber(num);
    if (!theCase) {
      failed.push(num);
      continue;
    }

    await pluginData.state.cases.setHidden(theCase.id, false);
  }

  if (failed.length === caseNumbers.length) {
    sendErrorMessage(pluginData, context, "None of the cases were found!");
    return;
  }

  const failedAddendum =
    failed.length > 0
      ? `\nThe following cases were not found: ${failed.toString().replace(new RegExp(",", "g"), ", ")}`
      : "";

  const amt = caseNumbers.length - failed.length;
  sendSuccessMessage(
    pluginData,
    context,
    `${amt} case${amt === 1 ? " is" : "s are"} no longer hidden!${failedAddendum}`,
  );
}
