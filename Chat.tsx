import React from 'react';
import RPCClient from '../lib/RPCClient';
import Storage from '../lib/Storage';
import lodash from 'lodash';
import classNames from 'classnames';
import {hexToRgb, parseQueryProps} from '../utils/WidgetUtils';
import {RPCCommands, RPCEvents} from '../Constants';
import styles from './Chat.module.scss';
import createReactClass from 'create-react-class';
import {useLocation, useParams} from 'react-router-dom';
import fromEntries from 'object.fromentries';

const Chat = createReactClass({
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
      fade_chat: 0,
    };

    return {
      channelName: 'loading..',
      messages: [],
      settings: {...defaultSettings, ...parseQueryProps(this.props.query)},
    };
  },

  componentWillMount() {
    RPCClient.connect();

    RPCClient.request(RPCCommands.GET_CHANNEL, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      this.setState({messages: data.messages, channelName: data.name});
    });

    RPCClient.subscribe(RPCEvents.MESSAGE_CREATE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      this.state.messages.push(data.message);
      this.forceUpdate();
    });

    RPCClient.subscribe(RPCEvents.MESSAGE_UPDATE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;
      // @ts-expect-error state types unknown
      let msg = this.state.messages.find((m) => {
        return data.message.id === m.id;
      });
      if (!msg) return;

      Object.assign(msg, data.message);
      this.forceUpdate();
    });

    RPCClient.subscribe(RPCEvents.MESSAGE_DELETE, {channel_id: this.props.params.channelId}, (error, data) => {
      if (error || data == null) return;

      lodash.remove(this.state.messages, (m) => {
        // @ts-expect-error state types unknown
        return m.id === data.message.id;
      });
      this.forceUpdate();
    });

    setInterval(() => {
      // @ts-expect-error state types unknown
      this.state.messages.forEach((message) => {
        const timeShown = Date.now() - new Date(message.timestamp).getTime();
        const fadeAt = this.state.settings.fade_chat * 1000;

        if (this.state.settings.fade_chat === 0) {
          return;
        }

        if (timeShown > fadeAt) {
          message.hidden = true;
        }
      });
      this.forceUpdate();
    }, 1000);

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

  componentDidUpdate() {
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    if (this.state.messages.length > 20) {
      this.setState({messages: this.state.messages.slice(-20)});
    }
  },

  contentParser(node: {[key: string]: any} | Array<{[key: string]: any}>) {
    if (Array.isArray(node)) {
      return node.map(this.contentParser);
    }

    if (!node) return '';

    switch (node.type) {
      case 'text':
        return node.content;
      case 'emoji':
        if (node.src) {
          return <img className={styles.emoji} src={node.src} alt={node.alt} width="25" />;
        } else {
          return node.alt;
        }
      case 'mention':
        return <span className={styles.mention}>{node.content[0].content}</span>;
      case 'inlineCode':
        return <code>{this.contentParser(node.content)}</code>;
      case 'codeBlock':
        return <pre>{this.contentParser(node.content)}</pre>;
      case 'em':
        return <em>{this.contentParser(node.content)}</em>;
      case 'strong':
        return <strong>{this.contentParser(node.content)}</strong>;
      case 'u':
        return <u>{this.contentParser(node.content)}</u>;
      case 'del':
        // @ts-expect-error unknown element
        return <strike>{this.contentParser(node.content)}</strike>;
      default:
        if (typeof node === 'string') return node;
        console.log('Unhandled content type ', node);
        return Array.isArray(node.content) ? this.contentParser(node.content) : '';
    }
  },

  renderMessage(msg: {[key: string]: any}) {
    const {text_color, text_size} = this.state.settings;

    const usernameStyle = {
      color: msg.author_color || undefined,
    };

    const rgbTextColor = hexToRgb(text_color);

    const textStyle = {
      color: `rgba(${rgbTextColor.r}, ${rgbTextColor.g}, ${rgbTextColor.b}, 0.6)`,
    };

    if (!msg.content) return null;

    const content = this.contentParser(msg.content_parsed);

    const timestamp = new Date(msg.timestamp).toLocaleTimeString(navigator.language, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const timestampStyle = {
      fontSize: text_size / 1.45,
    };

    return (
      <li
        key={msg.id}
        className={classNames(styles.message, {
          [styles.messageHidden]: msg.hidden,
        })}>
        <span className={styles.timestamp} style={timestampStyle}>
          {timestamp}
        </span>
        <span className={styles.username} style={usernameStyle}>
          {msg.nick || msg.author.username}
        </span>
        <span className={styles.messageText} style={textStyle}>
          {content}
        </span>
      </li>
    );
  },

  renderMessages() {
    const {bg_color, bg_opacity} = this.state.settings;

    const rgbBgColor = hexToRgb(bg_color);

    // @ts-expect-error state types unknown
    const messages = this.state.messages.map((m) => this.renderMessage(m));

    const messagesStyle = {
      backgroundColor: `rgba(${rgbBgColor.r}, ${rgbBgColor.g}, ${rgbBgColor.b}, ${bg_opacity - 0.1})`,
    };

    return (
      <ul className={styles.messages} style={messagesStyle} ref={(c) => (this.messageContainer = c)}>
        {messages}
      </ul>
    );
  },

  renderChannelName() {
    const {bg_color, bg_opacity} = this.state.settings;

    const rgbBgColor = hexToRgb(bg_color);

    const channelNameStyle = {
      backgroundColor: `rgba(${rgbBgColor.r}, ${rgbBgColor.g}, ${rgbBgColor.b}, ${bg_opacity})`,
    };

    return (
      <div className={styles.channelName} style={channelNameStyle}>
        <span className={styles.poundSign}>#</span>
        {this.state.channelName}
      </div>
    );
  },

  render() {
    const {
      text_color,
      text_size,
      text_outline_color,
      text_outline_size,
      text_shadow_color,
      text_shadow_size,
      bg_shadow_color,
      bg_shadow_size,
    } = this.state.settings;

    const containerStyle = {
      color: text_color,
      fontSize: text_size,
      WebkitTextStroke: text_outline_size > 0 ? `${text_outline_size}px ${text_outline_color}` : undefined,
      textShadow: text_shadow_size > 0 ? `1px 1px ${text_shadow_size}px ${text_shadow_color}` : undefined,
      boxShadow: bg_shadow_size > 0 ? `1px 1px ${bg_shadow_size}px ${bg_shadow_color}` : undefined,
    };

    return (
      <div className={styles.chatContainer} style={containerStyle}>
        {this.renderChannelName()}
        {this.renderMessages()}
      </div>
    );
  },
});

export default function ChatComponent() {
  const location = useLocation();
  const params = useParams();
  // @ts-expect-error props not typed
  return <Chat params={params} query={fromEntries(new URLSearchParams(location.search).entries())} />;
}
