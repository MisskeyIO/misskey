/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type PageHeaderItem = {
    text: string;
    icon: string;
    highlighted?: boolean;
    handler: (ev: MouseEvent) => Promise<void> | void;
};
