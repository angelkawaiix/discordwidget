import React from 'react';
import RPCClient from '../lib/RPCClient';
import Storage from '../lib/Storage';
import lodash from 'lodash';
import classNames from 'classnames';
import {hexToRgb, parseQueryProps} from '../utils/WidgetUtils';
import {RPCCommands, RPCEvents} from '../Constants';
import createReactClass from 'create-react-class';
import styles from './Voice.module.scss';
import {useLocation, useParams} from 'react-router-dom';
import fromEntries from 'object.fromentries';

// TODO: Probably move this to a more common file.
interface UserInfo {
  id: string;
  username: string;
  avatar: string;
  avatar_decoration_data: {
    asset: string;
    sku_id?: string;
  } | null;
  discriminator: string;
  bot: boolean;
  flags: number;
  premium_type: number;
}

interface VoiceState {
  nick: string;
  mute: boolean;
  volume: number;
  pan: {
    left: number;
    right: number;
  };
  voice_state: {
    mute: boolean;
    deaf: boolean;
    self_mute: boolean;
    self_deaf: boolean;
    suppress: boolean;
  };
  speaking?: boolean;
  user: UserInfo;
}

function getAvatarURL(user: UserInfo) {
  if (user.avatar == null || user.avatar === '') {
    return `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator) % 5}.png`;
  }

  if (RPCClient.config.cdn_host) {
    return `${window.location.protocol}//${RPCClient.config.cdn_host}/avatars/${user.id}/${user.avatar}.jpg`;
  } else {
    return `${window.location.protocol}${RPCClient.config.api_endpoint}/users/${user.id}/avatars/${user.avatar}.jpg`;
  }
}

interface VoiceProps {}

interface VoiceComponentState {
  voiceStates: VoiceState[];
  // TODO: Type this.
  settings: Record<string, any>;
}

const Voice = createReactClass<VoiceProps, VoiceComponentState>({
  getInitialState() {
    const defaultSettings = {
      text_color: '#ffffff',
      text_size: 14,
      text_outline_color: '#000000',
      text_outline_size: 0,
      text_shadow_color: '#000000',
      text_shadow_size: 0,
      bg_color: '#1e2124',
      bg_opacity: 0.95,
      bg_shadow_color: '#000000',
      bg_shadow_size: 0,
      limit_speaking: false,
      small_avatars: false,
      hide_names: false,
      streamer_avatar_first: false,
    };

    return {
      voiceStates: [],
      settings: {...defaultSettings, ...parseQueryProps(this.props.query)},
    };
  },

  componentWillMount() {
    RPCClient.connect();

    RPCClient.request(RPCCommands.GET_CHANNEL, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      this.setState({
        voiceStates: data.voice_states,
      });
    });

    RPCClient.subscribe(RPCEvents.VOICE_STATE_CREATE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      this.state.voiceStates.push(data);
      this.setState({
        voiceStates: lodash.uniqBy(this.state.voiceStates, 'user.id'),
      });
    });

    RPCClient.subscribe(RPCEvents.VOICE_STATE_DELETE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      lodash.remove(this.state.voiceStates, (v) => {
        // @ts-expect-error state types unknown
        return v.user.id === data.user.id;
      });
      this.forceUpdate();
    });

    RPCClient.subscribe(RPCEvents.VOICE_STATE_UPDATE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      // @ts-expect-error state types unknown
      const state = this.state.voiceStates.find((v) => {
        return v.user.id === data.user.id;
      });
      if (!state) return;
      Object.assign(state, data);
      this.forceUpdate();
    });

    RPCClient.subscribe(RPCEvents.SPEAKING_START, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      // @ts-expect-error state types unknown
      const state = this.state.voiceStates.find((v) => {
        return v.user.id === data.user_id;
      });
      if (!state) return;
      state.speaking = true;
      this.forceUpdate();
    });

    RPCClient.subscribe(RPCEvents.SPEAKING_STOP, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      // @ts-expect-error state types unknown
      const state = this.state.voiceStates.find((v) => {
        return v.user.id === data.user_id;
      });
      if (!state) return;
      state.speaking = false;
      this.forceUpdate();
    });

    if (!Object.keys(this.props.query).length) {
      window.addEventListener('storage', ({key, oldValue, newValue}) => {
        if (key !== 'settings' || newValue == null) return;

        this.setState({settings: JSON.parse(newValue)});
      });

      const settings = Storage.get('settings');
      if (settings) {
        this.setState({settings});
      }
    }
  },

  renderVoiceState(state: VoiceState) {
    const {
      text_color,
      text_size,
      text_outline_color,
      text_outline_size,
      text_shadow_color,
      text_shadow_size,
      bg_color,
      bg_opacity,
      bg_shadow_color,
      bg_shadow_size,
      small_avatars,
      hide_names,
    } = this.state.settings;

    const rgbBgColor = hexToRgb(bg_color);

    const nameStyle = {
      color: text_color,
      fontSize: text_size,
      WebkitTextStroke: text_outline_size > 0 ? `${text_outline_size}px ${text_outline_color}` : undefined,
      textShadow: text_shadow_size > 0 ? `1px 1px ${text_shadow_size}px ${text_shadow_color}` : undefined,
      boxShadow: bg_shadow_size > 0 ? `1px 1px ${bg_shadow_size}px ${bg_shadow_color}` : undefined,
      backgroundColor: `rgba(${rgbBgColor.r}, ${rgbBgColor.g}, ${rgbBgColor.b}, ${bg_opacity})`,
    };

    const user = !hide_names && (
      <div className={classNames(styles.user, {[styles.smallAvatarUser]: small_avatars}, 'voice_username')}>
        <span className={styles.name} style={nameStyle}>
          {state.nick || state.user.username}
        </span>
      </div>
    );

    return (
      <li
        className={classNames(
          styles.voiceState,
          {
            [styles.smallAvatar]: small_avatars,
            // classes to aid custom css styling for end users
            mute: state.voice_state.mute,
            deaf: state.voice_state.deaf,
            self_mute: state.voice_state.self_mute,
            self_deaf: state.voice_state.self_deaf,
            wrapper_speaking: state.speaking,
            is_widget_owner: RPCClient.user && RPCClient.user.id === state.user.id,
          },
          'voice_state'
        )}
        // data attribute for custom css selectors
        data-userid={state.user.id}
        key={state.user.id}>
        <img
          className={classNames(
            styles.avatar,
            {
              [styles.avatarSpeaking]: state.speaking,
              [styles.smallAvatarAvatar]: small_avatars,
            },
            'voice_avatar'
          )}
          src={getAvatarURL(state.user)}
          alt=""
        />
        {user}
      </li>
    );
  },

  renderVoiceStates() {
    const {limit_speaking, streamer_avatar_first} = this.state.settings;
    // @ts-expect-error state types unknown
    let voiceStates = this.state.voiceStates.filter((v) => !limit_speaking || v.speaking);

    // @ts-expect-error state types unknown
    voiceStates.sort((a, b) => {
      if (streamer_avatar_first) {
        if (a.user.id === RPCClient.user?.id) {
          return -1;
        }
        if (b.user.id === RPCClient.user?.id) {
          return 1;
        }
      }

      const nameA = a.nick || a.user.username;
      const nameB = b.nick || b.user.username;
      return nameA.localeCompare(nameB);
    });

    // @ts-expect-error state types unknown
    voiceStates = voiceStates.map((v) => this.renderVoiceState(v));

    return <ul className={classNames(styles.voiceStates, 'voice_states')}>{voiceStates}</ul>;
  },

  render() {
    return <div className={classNames(styles.voiceContainer, 'voice_container')}>{this.renderVoiceStates()}</div>;
  },
});

export default function VoiceComponent() {
  const location = useLocation();
  const params = useParams();
  // @ts-expect-error props not typed
  return <Voice params={params} query={fromEntries(new URLSearchParams(location.search).entries())} />;
}
