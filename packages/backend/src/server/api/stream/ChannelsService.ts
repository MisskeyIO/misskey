/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { HybridTimelineChannel } from './channels/hybrid-timeline.js';
import { LocalTimelineChannel } from './channels/local-timeline.js';
import { HomeTimelineChannel } from './channels/home-timeline.js';
import { GlobalTimelineChannel } from './channels/global-timeline.js';
import { MainChannel } from './channels/main.js';
import { ChannelChannel } from './channels/channel.js';
import { AdminChannel } from './channels/admin.js';
import { ServerStatsChannel } from './channels/server-stats.js';
import { QueueStatsChannel } from './channels/queue-stats.js';
import { UserListChannel } from './channels/user-list.js';
import { AntennaChannel } from './channels/antenna.js';
import { DriveChannel } from './channels/drive.js';
import { HashtagChannel } from './channels/hashtag.js';
import { RoleTimelineChannel } from './channels/role-timeline.js';
import { ChatUserChannel } from './channels/chat-user.js';
import { ChatRoomChannel } from './channels/chat-room.js';
import { ReversiChannel } from './channels/reversi.js';
import { ReversiGameChannel } from './channels/reversi-game.js';
import type { ChannelConstructor } from './channel.js';
import { bindThis } from '@/decorators.js';
import { HybridTimelineChannelService } from './channels/hybrid-timeline.js';
import { LocalTimelineChannelService } from './channels/local-timeline.js';
import { HomeTimelineChannelService } from './channels/home-timeline.js';
import { GlobalTimelineChannelService } from './channels/global-timeline.js';
import { MainChannelService } from './channels/main.js';
import { ChannelChannelService } from './channels/channel.js';
import { AdminChannelService } from './channels/admin.js';
import { QueueStatsChannelService } from './channels/queue-stats.js';
import { UserListChannelService } from './channels/user-list.js';
import { AntennaChannelService } from './channels/antenna.js';
import { DriveChannelService } from './channels/drive.js';
import { HashtagChannelService } from './channels/hashtag.js';
import { RoleTimelineChannelService } from './channels/role-timeline.js';
import { ChatUserChannelService } from './channels/chat-user.js';
import { ChatRoomChannelService } from './channels/chat-room.js';
import { ReversiChannelService } from './channels/reversi.js';
import { ReversiGameChannelService } from './channels/reversi-game.js';
import { type MiChannelService } from './channel.js';

@Injectable()
export class ChannelsService {
	constructor(
		private mainChannelService: MainChannelService,
		private homeTimelineChannelService: HomeTimelineChannelService,
		private localTimelineChannelService: LocalTimelineChannelService,
		private hybridTimelineChannelService: HybridTimelineChannelService,
		private globalTimelineChannelService: GlobalTimelineChannelService,
		private userListChannelService: UserListChannelService,
		private hashtagChannelService: HashtagChannelService,
		private roleTimelineChannelService: RoleTimelineChannelService,
		private antennaChannelService: AntennaChannelService,
		private channelChannelService: ChannelChannelService,
		private driveChannelService: DriveChannelService,
		private queueStatsChannelService: QueueStatsChannelService,
		private adminChannelService: AdminChannelService,
		private chatUserChannelService: ChatUserChannelService,
		private chatRoomChannelService: ChatRoomChannelService,
		private reversiChannelService: ReversiChannelService,
		private reversiGameChannelService: ReversiGameChannelService,
	) {
	}

	@bindThis
	public getChannelConstructor(name: string): ChannelConstructor<boolean> {
		switch (name) {
			case 'main': return this.mainChannelService;
			case 'homeTimeline': return this.homeTimelineChannelService;
			case 'localTimeline': return this.localTimelineChannelService;
			case 'hybridTimeline': return this.hybridTimelineChannelService;
			case 'globalTimeline': return this.globalTimelineChannelService;
			case 'userList': return this.userListChannelService;
			case 'hashtag': return this.hashtagChannelService;
			case 'roleTimeline': return this.roleTimelineChannelService;
			case 'antenna': return this.antennaChannelService;
			case 'channel': return this.channelChannelService;
			case 'drive': return this.driveChannelService;
			case 'queueStats': return this.queueStatsChannelService;
			case 'admin': return this.adminChannelService;
			case 'chatUser': return this.chatUserChannelService;
			case 'chatRoom': return this.chatRoomChannelService;
			case 'reversi': return this.reversiChannelService;
			case 'reversiGame': return this.reversiGameChannelService;

			default:
				throw new Error(`no such channel: ${name}`);
		}
	}
}
