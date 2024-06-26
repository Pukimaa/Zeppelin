import { GuildMember } from "discord.js";
import { commandTypeHelpers as ct } from "../../../commandTypes";
import { canActOn } from "../../../pluginUtils";
import { resolveMember, resolveRoleId, successMessage } from "../../../utils";
import { CommonPlugin } from "../../Common/CommonPlugin";
import { LogsPlugin } from "../../Logs/LogsPlugin";
import { RoleManagerPlugin } from "../../RoleManager/RoleManagerPlugin";
import { rolesCmd } from "../types";

export const MassRemoveRoleCmd = rolesCmd({
  trigger: "massremoverole",
  permission: "can_mass_assign",

  signature: {
    role: ct.string(),
    members: ct.string({ rest: true }),
  },

  async run({ message: msg, args, pluginData }) {
    msg.channel.send(`Resolving members...`);

    const members: GuildMember[] = [];
    const unknownMembers: string[] = [];
    for (const memberId of args.members) {
      const member = await resolveMember(pluginData.client, pluginData.guild, memberId);
      if (member) members.push(member);
      else unknownMembers.push(memberId);
    }

    for (const member of members) {
      if (!canActOn(pluginData, msg.member, member, true)) {
        pluginData
          .getPlugin(CommonPlugin)
          .sendErrorMessage(msg, "Cannot add roles to 1 or more specified members: insufficient permissions");
        return;
      }
    }

    const roleId = await resolveRoleId(pluginData.client, pluginData.guild.id, args.role);
    if (!roleId) {
      pluginData.getPlugin(CommonPlugin).sendErrorMessage(msg, "Invalid role id");
      return;
    }

    const config = await pluginData.config.getForMessage(msg);
    if (!config.assignable_roles.includes(roleId)) {
      pluginData.getPlugin(CommonPlugin).sendErrorMessage(msg, "You cannot remove that role");
      return;
    }

    const role = pluginData.guild.roles.cache.get(roleId);
    if (!role) {
      pluginData.getPlugin(LogsPlugin).logBotAlert({
        body: `Unknown role configured for 'roles' plugin: ${roleId}`,
      });
      pluginData.getPlugin(CommonPlugin).sendErrorMessage(msg, "You cannot remove that role");
      return;
    }

    const membersWithTheRole = members.filter((m) => m.roles.cache.has(roleId));
    let assigned = 0;
    const failed: string[] = [];
    const didNotHaveRole = members.length - membersWithTheRole.length;

    msg.channel.send(
      `Removing role **${role.name}** from ${membersWithTheRole.length} ${
        membersWithTheRole.length === 1 ? "member" : "members"
      }...`,
    );

    for (const member of membersWithTheRole) {
      pluginData.getPlugin(RoleManagerPlugin).removeRole(member.id, roleId);
      pluginData.getPlugin(LogsPlugin).logMemberRoleRemove({
        member,
        roles: [role],
        mod: msg.author,
      });
      assigned++;
    }

    let resultMessage = `Removed role **${role.name}** from  ${assigned} ${assigned === 1 ? "member" : "members"}!`;
    if (didNotHaveRole) {
      resultMessage += ` ${didNotHaveRole} ${didNotHaveRole === 1 ? "member" : "members"} didn't have the role.`;
    }

    if (failed.length) {
      resultMessage += `\nFailed to remove the role from the following members: ${failed.join(", ")}`;
    }

    if (unknownMembers.length) {
      resultMessage += `\nUnknown members: ${unknownMembers.join(", ")}`;
    }

    msg.channel.send(successMessage(resultMessage));
  },
});
