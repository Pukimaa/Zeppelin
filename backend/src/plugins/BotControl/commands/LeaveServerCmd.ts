import { Snowflake } from "discord.js";
import { commandTypeHelpers as ct } from "../../../commandTypes";
import { isStaffPreFilter } from "../../../pluginUtils";
import { CommonPlugin } from "../../Common/CommonPlugin";
import { botControlCmd } from "../types";

export const LeaveServerCmd = botControlCmd({
  trigger: ["leave_server", "leave_guild"],
  permission: null,
  config: {
    preFilters: [isStaffPreFilter],
  },

  signature: {
    guildId: ct.string(),
  },

  async run({ pluginData, message: msg, args }) {
    if (!pluginData.client.guilds.cache.has(args.guildId as Snowflake)) {
      pluginData.getPlugin(CommonPlugin).sendErrorMessage(msg, "I am not in that guild");
      return;
    }

    const guildToLeave = await pluginData.client.guilds.fetch(args.guildId as Snowflake)!;
    const guildName = guildToLeave.name;

    try {
      await pluginData.client.guilds.cache.get(args.guildId as Snowflake)?.leave();
    } catch (e) {
      pluginData.getPlugin(CommonPlugin).sendErrorMessage(msg, `Failed to leave guild: ${e.message}`);
      return;
    }

    pluginData.getPlugin(CommonPlugin).sendSuccessMessage(msg, `Left guild **${guildName}**`);
  },
});
