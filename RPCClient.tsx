import lodash from 'lodash';
import {EventEmitter} from 'events';
import {RPCCommands, RPCEvents, RPCErrors, OAUTH2_CLIENT_ID, TOKEN_ENDPOINT} from '../Constants';
import Storage from './Storage';
import superagent from 'superagent';
import {v4} from 'uuid';

function getEventName(cmd: string, nonce: string | null, evt: string | null) {
  return `${cmd}:${nonce || evt}`;
}

type Callback = (err: RPCError | null, response: {[key: string]: any} | null) => any;

class RPCError extends Error {
  code: number;

  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

interface RPCClientUser {
  id: string;
  username: string;
}

class RPCClient {
  evts: EventEmitter;
  accessToken: string | null | undefined;
  activeSubscriptions: Array<{
    evt: RPCEvents;
    args: {[key: string]: any};
    callback: Callback;
  }>;
  queue: Array<() => void>;
  connected: boolean;
  ready: boolean;
  authenticated: boolean;
  requestedDisconnect: boolean;
  connectionTries: number;
  socket: WebSocket | null;
  config: {[key: string]: any};
  user: RPCClientUser | null;

  constructor() {
    this.evts = new EventEmitter();
    this.accessToken = Storage.get('accessToken');
    this.activeSubscriptions = [];
    this.queue = [];
    this.connected = false;
    this.authenticated = false;
    this.ready = false;
    this.requestedDisconnect = false;
    this.connectionTries = 0;
    this.socket = null;
    this.config = {};
    this.user = null;

    // shares new access tokens across local storage
    window.addEventListener('storage', ({key, oldValue, newValue}) => {
      if (key !== 'accessToken' || oldValue === newValue) return;

      this.accessToken = newValue;
    });

    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });

    // @ts-expect-error attach debugging handle to window
    window.rpc = this;
  }

  connect(tries = 0) {
    if (this.connected) {
      return;
    }

    const port = 6463 + (tries % 10);

    try {
      this.socket = new WebSocket(`ws://127.0.0.1:${port}/?v=1&client_id=${OAUTH2_CLIENT_ID}`);
    } catch (_) {
      this._handleClose({code: 1006});
      return;
    }

    this.socket.onopen = this._handleOpen.bind(this);
    this.socket.onclose = this._handleClose.bind(this);
    this.socket.onmessage = this._handleMessage.bind(this);
  }

  disconnect() {
    if (!this.connected) {
      return;
    }

    this.requestedDisconnect = true;

    this.socket?.close();
  }

  reconnect() {
    if (!this.connected) {
      return;
    }

    this.socket?.close();
  }

  authenticate() {
    if (this.authenticated) {
      return;
    }

    if (!this.accessToken) {
      this.authorize();
      return;
    }

    this.request(
      RPCCommands.AUTHENTICATE,
      {
        access_token: this.accessToken,
      },
      (e, r) => {
        if (e && e.code === RPCErrors.INVALID_TOKEN) {
          this.authorize();
          return;
        }

        this.authenticated = true;

        if (r) {
          this.user = r.user;
        }

        this.flushQueue();

        this.activeSubscriptions.forEach((s) => this.subscribe(s.evt, s.args, s.callback));
      }
    );
  }

  flushQueue() {
    const queue = this.queue;
    this.queue = [];
    queue.forEach((c) => c());
  }

  authorize(tries = 0) {
    if (this.authenticated) {
      return;
    }

    this.request(RPCCommands.AUTHORIZE, {
      client_id: OAUTH2_CLIENT_ID,
      scopes: ['rpc', 'messages.read'],
      prompt: 'none',
    })
      .then((r) => superagent.post(TOKEN_ENDPOINT).send({code: r?.code}))
      .then((r) => {
        if (!r.ok) {
          throw new Error('no access token');
        }

        this.accessToken = r.body.access_token;
        Storage.set('accessToken', this.accessToken);

        this.authenticate();
      })
      .catch((e) => {
        console.log('Authorize Error', e);
        const backoff = Math.pow(2, tries);
        setTimeout(() => this.authorize(tries + 1), backoff);
      });
  }

  request(
    cmd: RPCCommands,
    args: {[key: string]: any},
    evt: RPCEvents | Callback | undefined = undefined,
    callback: Callback | undefined = undefined
  ): Promise<{[key: string]: any} | null> {
    if (typeof evt === 'function') {
      callback = evt;
      evt = undefined;
    }

    return new Promise((resolve, reject) => {
      if (
        !this.connected ||
        !this.ready ||
        (!this.authenticated && [RPCCommands.AUTHORIZE, RPCCommands.AUTHENTICATE].indexOf(cmd) === -1)
      ) {
        this.queue.push(() =>
          this.request(cmd, args, evt, (err, res) => {
            if (callback) {
              callback(err, res);
            }

            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          })
        );
        return;
      }

      const nonce = v4();

      this.evts.once(getEventName(RPCCommands.DISPATCH, nonce, null), (err, res) => {
        if (callback) {
          callback(err, res);
        }

        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });

      this.socket?.send(JSON.stringify({cmd, args, evt, nonce}));
    });
  }

  subscribe(evt: RPCEvents, args: {[key: string]: any}, callback: Callback) {
    this.request(RPCCommands.SUBSCRIBE, args, evt, (error) => {
      if (error) {
        callback(error, null);
        return;
      }

      // on reconnect we resub to events, so don't dup listens
      if (
        !this.activeSubscriptions.find((s) => {
          return callback === s.callback;
        })
      ) {
        this.activeSubscriptions.push({evt, args, callback});
        this.evts.on(getEventName(RPCCommands.DISPATCH, null, evt), (d) => callback(null, d));
      }
    });
  }

  unsubscribe(evt: RPCEvents, args: {[key: string]: any}, callback: Callback | null | undefined = undefined) {
    this.request(RPCCommands.UNSUBSCRIBE, args, evt, (error) => {
      if (error) {
        if (callback) {
          callback(error, null);
        }
        return;
      }

      lodash.remove(this.activeSubscriptions, (s) => {
        return evt === s.evt && lodash.isEqual(args, s.args);
      });

      const eventName = getEventName(RPCCommands.DISPATCH, null, evt);

      this.evts.listeners(eventName).forEach((cb) => {
        // @ts-expect-error unclear type
        this.evts.removeListener(eventName, cb);
      });

      if (callback) {
        callback(null, null);
      }
    });
  }

  _handleOpen() {
    this.connected = true;

    console.log('WS Open');

    this.authenticate();
  }

  _handleClose(e: CloseEvent | {code: number}) {
    this.connected = false;
    this.authenticated = false;
    this.ready = false;

    console.error('WS Closed: ', e);

    if (this.requestedDisconnect) {
      this.requestedDisconnect = false;
      return;
    }

    try {
      this.socket?.close();
    } catch (e) {}

    const tries = e.code === 1006 ? ++this.connectionTries : 0;
    const backoff = Math.pow(2, Math.floor(tries / 10));
    setTimeout(() => this.connect(tries), backoff);
  }

  _handleMessage(message: MessageEvent) {
    let payload = null;

    try {
      payload = JSON.parse(message.data);
    } catch (e) {
      console.error('Payload not JSON: ', payload);
      return;
    }

    let {cmd, evt, nonce, data} = payload;

    console.log('Incoming Payload: ', payload);

    if (cmd === RPCCommands.DISPATCH) {
      if (evt === RPCEvents.READY) {
        this.config = data.config;
        this.ready = true;
        this.flushQueue();
        return;
      }

      if (evt === RPCEvents.ERROR) {
        console.error('Dispatched Error: ', data);
        this.socket?.close();
        return;
      }

      this.evts.emit(getEventName(RPCCommands.DISPATCH, null, evt), data);
      return;
    }

    let error = null;
    if (evt === RPCEvents.ERROR) {
      error = new RPCError(data.message, data.code);
      data = null;
    }

    this.evts.emit(getEventName(RPCCommands.DISPATCH, nonce, null), error, data);
  }
}

export default new RPCClient();
