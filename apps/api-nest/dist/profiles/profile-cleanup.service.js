"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ProfileCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileCleanupService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let ProfileCleanupService = ProfileCleanupService_1 = class ProfileCleanupService {
    logger = new common_1.Logger(ProfileCleanupService_1.name);
    get agentStorePath() {
        return process.env.OPENCLAW_AGENT_STORE_PATH ?? '';
    }
    get storagePath() {
        return process.env.HEARTH_STORAGE_PATH ?? '';
    }
    async cleanupProfileData(options) {
        await Promise.allSettled([
            this.cleanupOpenClawSessions(options.sessionKeys),
            this.cleanupStorageFiles(options.profileId, options.conversationIds),
        ]);
    }
    async cleanupOpenClawSessions(sessionKeys) {
        if (!sessionKeys.length || !this.agentStorePath)
            return;
        const keysByAgent = new Map();
        for (const key of sessionKeys) {
            const normalizedKey = key.trim().toLowerCase();
            const match = normalizedKey.match(/^agent:([^:]+):/);
            const agentId = match?.[1];
            if (!agentId)
                continue;
            if (!keysByAgent.has(agentId)) {
                keysByAgent.set(agentId, []);
            }
            keysByAgent.get(agentId).push(normalizedKey);
        }
        for (const [agentId, keys] of keysByAgent) {
            await this.cleanupAgentSessions(agentId, keys);
        }
    }
    async cleanupAgentSessions(agentId, sessionKeys) {
        const sessionsDir = (0, node_path_1.join)(this.agentStorePath, agentId, 'sessions');
        const indexPath = (0, node_path_1.join)(sessionsDir, 'sessions.json');
        if (!(0, node_fs_1.existsSync)(indexPath)) {
            this.logger.debug(`No sessions index found for agent ${agentId}`);
            return;
        }
        let index;
        try {
            const raw = await (0, promises_1.readFile)(indexPath, 'utf-8');
            index = JSON.parse(raw);
        }
        catch (err) {
            this.logger.warn(`Failed to read sessions index for agent ${agentId}: ${err}`);
            return;
        }
        const sessionIdsToDelete = [];
        for (const key of sessionKeys) {
            const entry = index[key];
            if (entry?.sessionId) {
                sessionIdsToDelete.push(entry.sessionId);
                delete index[key];
                this.logger.log(`Removing session key from index: ${key}`);
            }
        }
        if (!sessionIdsToDelete.length) {
            return;
        }
        try {
            await (0, promises_1.writeFile)(indexPath, JSON.stringify(index, null, 2), 'utf-8');
        }
        catch (err) {
            this.logger.warn(`Failed to write updated sessions index for agent ${agentId}: ${err}`);
        }
        for (const sessionId of sessionIdsToDelete) {
            const filePath = (0, node_path_1.join)(sessionsDir, `${sessionId}.jsonl`);
            try {
                await (0, promises_1.rm)(filePath, { force: true });
                this.logger.log(`Deleted session file: ${filePath}`);
            }
            catch (err) {
                this.logger.warn(`Failed to delete session file ${filePath}: ${err}`);
            }
        }
    }
    async cleanupStorageFiles(profileId, conversationIds) {
        if (!this.storagePath)
            return;
        const userDir = (0, node_path_1.join)(this.storagePath, 'attachments', 'users', String(profileId));
        if ((0, node_fs_1.existsSync)(userDir)) {
            try {
                await (0, promises_1.rm)(userDir, { recursive: true, force: true });
                this.logger.log(`Deleted user storage dir: ${userDir}`);
            }
            catch (err) {
                this.logger.warn(`Failed to delete user storage dir ${userDir}: ${err}`);
            }
        }
        if (conversationIds.length) {
            const tmpBase = (0, node_path_1.join)(this.storagePath, 'attachments', 'tmp');
            if ((0, node_fs_1.existsSync)(tmpBase)) {
                for (const conversationId of conversationIds) {
                    const dirPath = (0, node_path_1.join)(tmpBase, String(conversationId));
                    if (!(0, node_fs_1.existsSync)(dirPath))
                        continue;
                    try {
                        await (0, promises_1.rm)(dirPath, { recursive: true, force: true });
                        this.logger.log(`Deleted tmp dir for conversation ${conversationId}`);
                    }
                    catch (err) {
                        this.logger.warn(`Failed to delete tmp dir ${dirPath}: ${err}`);
                    }
                }
            }
        }
    }
};
exports.ProfileCleanupService = ProfileCleanupService;
exports.ProfileCleanupService = ProfileCleanupService = ProfileCleanupService_1 = __decorate([
    (0, common_1.Injectable)()
], ProfileCleanupService);
