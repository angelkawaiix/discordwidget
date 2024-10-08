export const APP_PATH = '/overlay';

// The token endpoint is part of the Cloudflare worker deployment. It simply does OAuth2 token exchanges.
export const TOKEN_ENDPOINT =
  window.location.origin === 'http://localhost:3000'
    ? 'https://streamkit.discord.com/overlay/token'
    : `${window.location.origin}/overlay/token`;
export const OAUTH2_CLIENT_ID = '207646673902501888';

export enum RPCCommands {
  DISPATCH = 'DISPATCH',

  AUTHORIZE = 'AUTHORIZE',
  AUTHENTICATE = 'AUTHENTICATE',

  GET_GUILD = 'GET_GUILD',
  GET_GUILDS = 'GET_GUILDS',
  GET_CHANNEL = 'GET_CHANNEL',
  GET_CHANNELS = 'GET_CHANNELS',
  CREATE_CHANNEL_INVITE = 'CREATE_CHANNEL_INVITE',

  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',

  SET_LOCAL_VOLUME = 'SET_LOCAL_VOLUME',
  SELECT_VOICE_CHANNEL = 'SELECT_VOICE_CHANNEL',
}

export enum RPCEvents {
  GUILD_STATUS = 'GUILD_STATUS',

  VOICE_STATE_CREATE = 'VOICE_STATE_CREATE',
  VOICE_STATE_DELETE = 'VOICE_STATE_DELETE',
  VOICE_STATE_UPDATE = 'VOICE_STATE_UPDATE',
  SPEAKING_START = 'SPEAKING_START',
  SPEAKING_STOP = 'SPEAKING_STOP',

  MESSAGE_CREATE = 'MESSAGE_CREATE',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
  MESSAGE_DELETE = 'MESSAGE_DELETE',

  READY = 'READY',
  ERROR = 'ERROR',
}

export enum RPCErrors {
  UNKNOWN_ERROR = 1000,

  INVALID_PAYLOAD = 4000,
  INVALID_VERSION = 4001,
  INVALID_COMMAND = 4002,
  INVALID_GUILD = 4003,
  INVALID_EVENT = 4004,
  INVALID_CHANNEL = 4005,
  INVALID_PERMISSIONS = 4006,
  INVALID_CLIENTID = 4007,
  INVALID_ORIGIN = 4008,
  INVALID_TOKEN = 4009,
  INVALID_USER = 4010,

  OAUTH2_ERROR = 5000,
}

export enum RPCCloseCodes {
  INVALID_CLIENTID = 4000,
  INVALID_ORIGIN = 4001,
  RATELIMITED = 4002,
  TOKEN_REVOKED = 4003,
}

export enum ChannelTypes {
  DM = 1,
  GROUP_DM = 3,
  GUILD_TEXT = 0,
  GUILD_VOICE = 2,
}
