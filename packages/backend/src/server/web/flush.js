/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

'use strict';

const msg = document.getElementById('msg');
const successText = `\nSuccess Flush! <a href="/">Back to Misskey</a>\n成功しました。<a href="/">Misskeyを開き直してください。</a>`;

message('Start flushing.');

(async function () {
    try {
        localStorage.clear();
        message('localStorage cleared.');

        const idbPromises = ['MisskeyClient', 'keyval-store'].map((name, i, arr) => new Promise((res, rej) => {
            const delidb = indexedDB.deleteDatabase(name);
            delidb.onsuccess = () => res(message(`indexedDB "${name}" cleared. (${i + 1}/${arr.length})`));
            delidb.onerror = e => rej(e)
        }));

        await Promise.all(idbPromises);

        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage('clear');
            await navigator.serviceWorker.getRegistrations()
                .then(registrations => {
                    return Promise.all(registrations.map(registration => registration.unregister()));
                })
                .catch(e => { throw new Error(e) });
        }

        message(successText);
    } catch (e) {
        message(`\n${e}\n\nFlush Failed. <a href="/flush">Please retry.</a>\n失敗しました。<a href="/flush">もう一度試してみてください。</a>`);
        message(`\nIf you retry more than 3 times, clear the browser cache or contact to instance admin.\n3回以上試しても失敗する場合、ブラウザのキャッシュを消去し、それでもだめならインスタンス管理者に連絡してみてください。\n`)

        console.error(e);
        setTimeout(() => {
            window.location = '/';
        }, 10000)
    }
})();

function message(text) {
    msg.insertAdjacentHTML('beforeend', `<p>[${(new Date()).toString()}] ${text.replace(/\n/g, '<br>')}</p>`)
}
