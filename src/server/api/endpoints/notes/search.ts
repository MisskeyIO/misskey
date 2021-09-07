import $ from 'cafy';
import es from '../../../../db/elasticsearch';
import define from '../../define';
import { Notes } from '@/models/index';
import { In } from 'typeorm';
import { ID } from '@/misc/cafy-id';
import config from '@/config/index';
import { makePaginationQuery } from '../../common/make-pagination-query';
import { generateVisibilityQuery } from '../../common/generate-visibility-query';
import { generateMutedUserQuery } from '../../common/generate-muted-user-query';
import { generateBlockedUserQuery } from '../../common/generate-block-query';

export const meta = {
	tags: ['notes'],

	requireCredential: false as const,

	params: {
		query: {
			validator: $.str
		},

		sinceId: {
			validator: $.optional.type(ID),
		},

		untilId: {
			validator: $.optional.type(ID),
		},

		limit: {
			validator: $.optional.num.range(1, 100),
			default: 10
		},

		host: {
			validator: $.optional.nullable.str,
			default: undefined
		},

		userId: {
			validator: $.optional.nullable.type(ID),
			default: null
		},

		channelId: {
			validator: $.optional.nullable.type(ID),
			default: null
		},
	},

	res: {
		type: 'array' as const,
		optional: false as const, nullable: false as const,
		items: {
			type: 'object' as const,
			optional: false as const, nullable: false as const,
			ref: 'Note',
		}
	},

	errors: {
	}
};

export default define(meta, async (ps, me) => {
	if (es == null) {
		const query = makePaginationQuery(Notes.createQueryBuilder('note'), ps.sinceId, ps.untilId);
		const sinceRegex = /since:([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])) /g;
		const untilRegex = /until:([0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])) /g;
		const hostRegex = /host:([a-zA-Z0-9.-]+) /g;

		if (ps.userId) {
			query.andWhere('note.userId = :userId', { userId: ps.userId });
		} else if (ps.channelId) {
			query.andWhere('note.channelId = :channelId', { channelId: ps.channelId });
		}

		if (sinceRegex.test(ps.query)) {
			query.andWhere('note.createdAt > :since', {since: `${RegExp.$1}`});
			ps.query = ps.query.replaceAll(sinceRegex, '');
		}
		if (untilRegex.test(ps.query)) {
			query.andWhere('note.createdAt < :until', {until: `${RegExp.$1} 23:59:59`});
			ps.query = ps.query.replaceAll(untilRegex, '');
		}
		if (hostRegex.test(ps.query)) {
			if (RegExp.$1 === 'local') {
				query.andWhere('note.userHost IS NULL');
			} else {
				query.andWhere('note.userHost = :host', {host: `${RegExp.$1}`});
			}
			ps.query = ps.query.replaceAll(hostRegex, '');
		}

		ps.query = ps.query.replaceAll(/\s\s+/g, ' ');

		query
			.andWhere('note.text &@~ :q', { q: `${ps.query}` })
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote')
			.leftJoinAndSelect('reply.user', 'replyUser')
			.leftJoinAndSelect('renote.user', 'renoteUser');

		generateVisibilityQuery(query, me);
		if (me) generateMutedUserQuery(query, me);
		if (me) generateBlockedUserQuery(query, me);

		const notes = await query.take(ps.limit!).getMany();

		return await Notes.packMany(notes, me);
	} else {
		const userQuery = ps.userId != null ? [{
			term: {
				userId: ps.userId
			}
		}] : [];

		const hostQuery = ps.userId == null ?
			ps.host === null ? [{
				bool: {
					must_not: {
						exists: {
							field: 'userHost'
						}
					}
				}
			}] : ps.host !== undefined ? [{
				term: {
					userHost: ps.host
				}
			}] : []
		: [];

		const result = await es.search({
			index: config.elasticsearch.index || 'misskey_note',
			body: {
				size: ps.limit!,
				from: ps.offset,
				query: {
					bool: {
						must: [{
							simple_query_string: {
								fields: ['text'],
								query: ps.query.toLowerCase(),
								default_operator: 'and'
							},
						}, ...hostQuery, ...userQuery]
					}
				},
				sort: [{
					_doc: 'desc'
				}]
			}
		});

		const hits = result.body.hits.hits.map((hit: any) => hit._id);

		if (hits.length === 0) return [];

		// Fetch found notes
		const notes = await Notes.find({
			where: {
				id: In(hits)
			},
			order: {
				id: -1
			}
		});

		return await Notes.packMany(notes, me);
	}
});
