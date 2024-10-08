import React from 'react';
import RPCClient from '../lib/RPCClient';
import Storage from '../lib/Storage';
import {hexToRgb, parseQueryProps} from '../utils/WidgetUtils';
import superagent from 'superagent';
import {RPCEvents} from '../Constants';
import createReactClass from 'create-react-class';
import styles from './Status.module.scss';
import {useLocation, useParams} from 'react-router-dom';
import fromEntries from 'object.fromentries';

import blackLogo from '../images/discord_logo_black.svg';
import colorLogo from '../images/discord_logo_color.svg';
import whiteLogo from '../images/discord_logo_white.svg';

const LogoPaths = {
  black: blackLogo,
  color: colorLogo,
  white: whiteLogo,
};

const Status = createReactClass({
  getInitialState() {
    const defaultSettings = {
      icon: true,
      online: true,
      logo: 'white',
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
      invite_code: '',
    };

    console.log('query', this.props.query, parseQueryProps(this.props.query));

    return {
      name: '',
      online: 0,
      icon: null,
      settings: {...defaultSettings, ...parseQueryProps(this.props.query)},
    };
  },

  componentWillMount() {
    RPCClient.connect();

    RPCClient.subscribe(RPCEvents.GUILD_STATUS, {guild_id: this.props.params.guildId}, (error, d) => {
      if (error || d == null) return;
      const {guild} = d;
      this.setState({name: guild.name, icon: guild.icon_url});
      this.updateOnlineCount();
    });

    if (!Object.keys(this.props.query).length) {
      window.addEventListener('storage', ({key, oldValue, newValue}) => {
        if (key !== 'settings' || newValue == null) return;

        this.setState({settings: JSON.parse(newValue)}, () => this.updateOnlineCount());
      });

      const settings = Storage.get('settings');
      if (settings) {
        this.setState({settings}, () => this.updateOnlineCount());
      }
    }
  },

  updateOnlineCount() {
    const inviteCode = this.state.settings.invite_code;
    if (!inviteCode || RPCClient.config.api_endpoint == null) return;

    superagent
      .get(`${window.location.protocol}${RPCClient.config.api_endpoint}/invites/${inviteCode}?with_counts=true`)
      .then(({body}) => body.approximate_presence_count || 0)
      .then((online) => this.setState({online}));
  },

  render() {
    const {
      icon,
      logo,
      online,
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
      invite_code,
    } = this.state.settings;

    let serverIcon = null;
    if (icon && this.state.icon) {
      serverIcon = (
        <div className={styles.serverIcon}>
          <img src={this.state.icon} alt="" />
        </div>
      );
    }

    let onlineCount = null;
    if (online) {
      onlineCount = (
        <span className={styles.onlineCount} style={{fontSize: (text_size * 0.857).toFixed(2)}}>
          {this.state.online} Online
        </span>
      );
    }

    let inviteLink = null;
    if (invite_code) {
      inviteLink = (
        <div className={styles.inviteLink} style={{fontSize: (text_size * 1.14).toFixed(2)}}>
          discord.gg/{invite_code}
        </div>
      );
    }

    const rgbBgColor = hexToRgb(bg_color);

    const containerStyle = {
      color: text_color,
      fontSize: text_size,
      WebkitTextStroke: text_outline_size > 0 ? `${text_outline_size}px ${text_outline_color}` : undefined,
      textShadow: text_shadow_size > 0 ? `1px 1px ${text_shadow_size}px ${text_shadow_color}` : undefined,
      boxShadow: bg_shadow_size > 0 ? `1px 1px ${bg_shadow_size}px ${bg_shadow_color}` : undefined,
      backgroundColor: `rgba(${rgbBgColor.r}, ${rgbBgColor.g}, ${rgbBgColor.b}, ${bg_opacity})`,
    };

    // @ts-expect-error
    const logoPath = LogoPaths[logo];
    const statusStyle = {
      backgroundImage: logoPath != null ? `url('${logoPath}')` : undefined,
    };

    return (
      <div className={styles.statusContainer} style={containerStyle}>
        <div className={styles.status} style={statusStyle}>
          {serverIcon}
          <div className={styles.serverInfo}>
            <span className={styles.name}>{this.state.name}</span>
            {onlineCount}
          </div>
          {inviteLink}
        </div>
      </div>
    );
  },
});

export default function StatusComponent() {
  const location = useLocation();
  const params = useParams();
  // @ts-expect-error props not typed
  return <Status params={params} query={fromEntries(new URLSearchParams(location.search).entries())} />;
}
