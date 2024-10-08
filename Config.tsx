import React from 'react';
import lodash from 'lodash';
import RPCClient from '../lib/RPCClient';
import Storage from '../lib/Storage';
import classNames from 'classnames';
import Select from 'react-select';
import Switch from 'react-switch';
import {SketchPicker} from 'react-color';
import ReactSlider from 'react-slider';
import createReactClass from 'create-react-class';
import {ChannelTypes, RPCCommands, APP_PATH} from '../Constants';
import styles from './Config.module.scss';

import discoredStreamkitLogo from '../images/discord_streamkit_logo.svg';
import previewStatusBg from '../images/preview_status_bg.png';
import previewChatBg from '../images/preview_chat_bg.png';
import previewVoiceBg from '../images/preview_voice_bg.png';
import icClose48Px from '../images/ic_close_48px.svg';

const HELP_LINKS = {
  obs: 'https://support.discord.com/hc/en-us/articles/223415707',
  xsplit: 'https://support.discord.com/hc/en-us/articles/223499048',
};

enum Keys {
  SelectedGuild = 'SelectedGuild',
  SelectedVoiceChannel = 'SelectedVoiceChannel',
  SelectedTextChannel = 'SelectedTextChannel',
}

function getGuildInvite(guildId: string, channelId: string) {
  return RPCClient.request(RPCCommands.GET_GUILD, {guild_id: guildId}).then((data) => {
    if (data?.vanity_url_code != null) {
      return data.vanity_url_code;
    }

    return RPCClient.request(RPCCommands.CREATE_CHANNEL_INVITE, {
      channel_id: channelId,
      max_age: 0,
      max_uses: 0,
      temporary: false,
    }).then((data) => data?.code || '');
  });
}

function FormSwitch({checked, onChange}: {checked: boolean; onChange: () => void}) {
  return (
    <Switch
      height={20}
      width={50}
      uncheckedIcon={false}
      checkedIcon={false}
      onColor="#3ba53b"
      offColor="#604f56"
      boxShadow="0px 1px 1px 0px rgba(0, 0, 0, 0.3)"
      handleDiameter={28}
      checked={checked}
      onChange={onChange}
    />
  );
}

const Config = createReactClass({
  getInitialState() {
    return {
      selectedGuild: Storage.get(Keys.SelectedGuild) || null,
      selectedVoiceChannel: Storage.get(Keys.SelectedVoiceChannel) || null,
      selectedTextChannel: Storage.get(Keys.SelectedTextChannel) || null,
      guilds: null,
      voiceChannels: null,
      textChannels: null,
      selectedWidget: 'status',
      connectNotice: false,
      connectTimeout: null,
      showForm: false,
      showLivePreview: false,
      formType: null,
      displayColorPicker: {
        text_color: false,
        text_outline_color: false,
        text_shadow_color: false,
        bg_color: false,
        bg_shadow_color: false,
      },
      settings: {
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
        limit_speaking: false,
        small_avatars: false,
        hide_names: false,
        fade_chat: 0,
        streamer_avatar_first: false,
      },
    };
  },

  connectToDiscord() {
    if (!this.state.showForm) {
      return;
    }

    RPCClient.connect();

    this.setState({connectNotice: false});
    clearTimeout(this.connectTimeout);
    this.connectTimeout = setTimeout(() => this.setState({connectNotice: true}), 3000);

    RPCClient.request(RPCCommands.GET_GUILDS, {}, (err, data) => {
      if (err || data == null) {
        return;
      }

      clearTimeout(this.connectTimeout);

      this.setState({
        guilds: data.guilds,
        connectNotice: false,
        showLivePreview: true,
      });
    });

    if (this.state.selectedGuild) {
      this.handleSelectGuild(this.state.selectedGuild);
    }
  },

  handleSelectGuild(selectedGuild: {value: string} | string) {
    if (selectedGuild != null && typeof selectedGuild === 'object') {
      selectedGuild = selectedGuild.value;
    }

    Storage.set(Keys.SelectedGuild, selectedGuild);

    if (this.state.selectedGuild !== selectedGuild) {
      this.setState({selectedGuild, selectedVoiceChannel: null, selectedTextChannel: null});
    }

    RPCClient.request(RPCCommands.GET_CHANNELS, {guild_id: selectedGuild}, (err, data) => {
      if (err || data == null) {
        return;
      }

      this.generateInstantInvite();

      this.setState({
        // @ts-expect-error unknown type
        voiceChannels: data.channels.filter((c) => c.type === ChannelTypes.GUILD_VOICE),
        // @ts-expect-error unknown type
        textChannels: data.channels.filter((c) => c.type === ChannelTypes.GUILD_TEXT),
      });
    });
  },

  generateInstantInvite() {
    const {selectedGuild, selectedTextChannel} = this.state;
    getGuildInvite(selectedGuild, selectedTextChannel).then((code) => {
      // eslint-disable-next-line react/no-direct-mutation-state
      this.state.settings.invite_code = code;
      this.forceUpdate();
    });
  },

  handleSelectVoiceChannel(selectedVoiceChannel: {value: string} | string) {
    if (selectedVoiceChannel != null && typeof selectedVoiceChannel === 'object') {
      selectedVoiceChannel = selectedVoiceChannel.value;
    }

    Storage.set(Keys.SelectedVoiceChannel, selectedVoiceChannel);

    if (this.state.selectedVoiceChannel !== selectedVoiceChannel) {
      RPCClient.request(RPCCommands.SELECT_VOICE_CHANNEL, {channel_id: selectedVoiceChannel});
      this.setState({selectedVoiceChannel});
    }
  },

  handleSelectTextChannel(selectedTextChannel: {value: string} | string, generateInstantInvite: boolean = false) {
    if (selectedTextChannel != null && typeof selectedTextChannel === 'object') {
      selectedTextChannel = selectedTextChannel.value;
    }

    Storage.set(Keys.SelectedTextChannel, selectedTextChannel);

    if (this.state.selectedTextChannel !== selectedTextChannel) {
      this.setState({selectedTextChannel}, () => {
        if (generateInstantInvite) {
          this.generateInstantInvite();
        }
      });
    }
  },

  handleToggleInvite() {
    if (this.state.settings.invite_code.length) {
      // eslint-disable-next-line react/no-direct-mutation-state
      this.state.settings.invite_code = '';
      this.forceUpdate();
      return;
    }

    this.generateInstantInvite();
  },

  handleToggleSetting(setting: string) {
    // eslint-disable-next-line react/no-direct-mutation-state
    this.state.settings[setting] = !this.state.settings[setting];
    this.forceUpdate();
  },

  handleSettingChange(setting: string, value: {value: string} | string) {
    if (value != null && typeof value === 'object') {
      value = value.value;
    }

    // eslint-disable-next-line react/no-direct-mutation-state
    this.state.settings[setting] = value;
    this.forceUpdate();
  },

  toggleForm(type = null) {
    if (!this.state.showForm) {
      setTimeout(this.connectToDiscord, 1000);
    } else {
      this.setState({
        showLivePreview: false,
      });
    }

    this.setState({
      formType: type ? type : this.state.formType,
      showForm: !this.state.showForm,
    });
  },

  changeType(type: string) {
    this.setState({
      selectedWidget: type,
    });
  },

  selectAllAndCopy(e: React.MouseEventHandler<HTMLInputElement>) {
    // @ts-expect-error not sure why target is not in the type
    e.target.select();

    document.execCommand('copy');
  },

  getSourceInfo() {
    const {selectedWidget, selectedGuild, selectedTextChannel, selectedVoiceChannel} = this.state;

    let path = null;
    let width;
    let height;

    switch (selectedWidget) {
      case 'status':
        if (selectedGuild) {
          path = `/${this.state.selectedWidget}/${this.state.selectedGuild}`;
        }
        width = 312;
        height = 64;
        break;
      case 'voice':
        if (selectedGuild && selectedVoiceChannel) {
          path = `/${this.state.selectedWidget}/${this.state.selectedGuild}/${this.state.selectedVoiceChannel}`;
        }
        width = 312;
        height = 600;
        break;
      case 'chat':
        if (selectedGuild && selectedTextChannel) {
          path = `/${this.state.selectedWidget}/${this.state.selectedGuild}/${this.state.selectedTextChannel}`;
        }
        width = 580;
        height = 215;
        break;
    }

    return {
      url: path
        ? `${new URL(APP_PATH + path, window.location.origin).toString()}?${new URLSearchParams(
            this.state.settings
          ).toString()}`
        : '',
      width,
      height,
    };
  },

  toggleColorPicker(setting: string, event: MouseEvent) {
    event.stopPropagation();
    const displayColorPicker = this._hideColorPickers();
    displayColorPicker[setting] = !this.state.displayColorPicker[setting];
    this.setState({displayColorPicker});
  },

  handleSetColorPicker(setting: string, color: {hex: string}) {
    // eslint-disable-next-line react/no-direct-mutation-state
    this.state.settings[setting] = color.hex;
    this.forceUpdate();
  },

  renderColorPicker(setting: string) {
    let colorPicker = null;

    if (this.state.displayColorPicker[setting]) {
      colorPicker = (
        <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
          <SketchPicker color={this.state.settings[setting]} onChange={this.handleSetColorPicker.bind(this, setting)} />
        </div>
      );
    }

    return (
      <div>
        <div>
          <div className={styles.swatch} onClick={this.toggleColorPicker.bind(this, setting)}>
            <div className={styles.hexColor}>{this.state.settings[setting]}</div>
            <div className={styles.color} style={{backgroundColor: this.state.settings[setting]}} />
          </div>
        </div>
        {colorPicker}
      </div>
    );
  },

  renderWidgetTypes() {
    return ['status', 'chat', 'voice'].map((type) => {
      return (
        <button
          key={`widget-${type}`}
          value={type}
          onClick={this.changeType.bind(this, type)}
          className={classNames({[styles.selected]: this.state.selectedWidget === type})}>
          {type} widget
        </button>
      );
    });
  },

  renderLivePreview() {
    const source = this.getSourceInfo();

    if (!source.url || !this.state.showForm || !this.state.showLivePreview) {
      return '';
    }

    Storage.set('settings', this.state.settings);

    const url = source.url.split('?')[0];

    if (this.state.origPreviewUrl !== url) {
      // eslint-disable-next-line react/no-direct-mutation-state
      this.state.previewUrl = url.replace('#', `?${Date.now()}#`);
      // eslint-disable-next-line react/no-direct-mutation-state
      this.state.origPreviewUrl = url;
    }

    return (
      <div className={styles.livePreview}>
        <iframe
          title="preview"
          src={this.state.previewUrl}
          scrolling="no"
          width={source.width}
          height={source.height}
        />
      </div>
    );
  },

  renderForm() {
    const guilds: Array<{value: string; label: string}> =
      this.state.guilds &&
      lodash.map(this.state.guilds, ({id, name}) => {
        return {value: id, label: name};
      });

    const voiceChannels: Array<{value: string; label: string}> =
      this.state.voiceChannels &&
      lodash.map(this.state.voiceChannels, ({id, name}) => {
        return {value: id, label: name};
      });

    const textChannels: Array<{value: string; label: string}> =
      this.state.textChannels &&
      lodash.map(this.state.textChannels, ({id, name}) => {
        return {value: id, label: name};
      });

    const logos = [
      {value: 'black', label: 'Black'},
      {value: 'color', label: 'Blurple'},
      {value: 'white', label: 'White'},
    ];

    let form = [];

    form.push(
      <div className={styles.formGroup} key="selected-guild">
        <label>Server</label>
        <Select
          classNames={{
            container: () => styles.select,
            control: () => styles.selectControl,
            placeholder: () => styles.selectPlaceholder,
            menu: () => styles.selectMenuOuter,
          }}
          value={guilds ? guilds.find(({value}) => value === this.state.selectedGuild) : null}
          isLoading={this.state.guilds === null}
          options={guilds}
          onChange={this.handleSelectGuild}
          placeholder="Select a Server"
        />
      </div>
    );

    if (this.state.selectedWidget === 'voice') {
      form.push(
        <div className={styles.formGroup} key="selected-voice-channel">
          <label>Voice Channel</label>
          <Select
            classNames={{
              container: () => styles.select,
              control: () => styles.selectControl,
              placeholder: () => styles.selectPlaceholder,
              menu: () => styles.selectMenuOuter,
            }}
            value={voiceChannels ? voiceChannels.find(({value}) => value === this.state.selectedVoiceChannel) : null}
            isLoading={this.state.voiceChannels === null}
            options={voiceChannels}
            onChange={this.handleSelectVoiceChannel}
            placeholder="Select a Voice Channel"
          />
        </div>
      );
    } else if (this.state.selectedWidget === 'chat') {
      form.push(
        <div className={styles.formGroup} key="selected-text-channel">
          <label>Text Channel</label>
          <Select
            classNames={{
              container: () => styles.select,
              control: () => styles.selectControl,
              placeholder: () => styles.selectPlaceholder,
              menu: () => styles.selectMenuOuter,
            }}
            value={textChannels ? textChannels.find(({value}) => value === this.state.selectedTextChannel) : null}
            isLoading={this.state.textChannels === null}
            options={textChannels}
            onChange={this.handleSelectTextChannel}
            placeholder="Select a Text Channel"
          />
        </div>
      );
    }

    form.push(<hr key="divider" />);

    if (this.state.selectedWidget === 'status') {
      form.push(
        <div className={styles.category} key="status-settings">
          <div className={styles.formGroup}>
            <label>Display Online Count</label>
            <FormSwitch checked={this.state.settings.online} onChange={() => this.handleToggleSetting('online')} />
          </div>
          <div className={styles.formGroup}>
            <label>Display Server Icon</label>
            <FormSwitch checked={this.state.settings.icon} onChange={() => this.handleToggleSetting('icon')} />
          </div>
          <div className={styles.formGroup}>
            <label>Display Invite Link</label>
            <FormSwitch
              checked={this.state.settings.invite_code.length > 0}
              onChange={() => this.handleToggleInvite()}
            />
          </div>
          <div className={styles.formGroup} key="selected-text-channel">
            <label>Invite Channel</label>
            <Select
              classNames={{
                container: () => styles.select,
                control: () => styles.selectControl,
                placeholder: () => styles.selectPlaceholder,
                menu: () => styles.selectMenuOuter,
              }}
              value={textChannels ? textChannels.find(({value}) => value === this.state.selectedTextChannel) : null}
              isLoading={this.state.textChannels === null}
              options={textChannels}
              onChange={(selectedTextChannel) => this.handleSelectTextChannel(selectedTextChannel, true)}
              placeholder="Select a Channel"
            />
          </div>
          <div className={styles.formGroup} key="selected-logo">
            <label>Discord Logo</label>
            <Select
              classNames={{
                container: () => styles.select,
                control: () => styles.selectControl,
                placeholder: () => styles.selectPlaceholder,
                menu: () => styles.selectMenuOuter,
              }}
              value={logos.find(({value}) => value === this.state.settings.logo)}
              options={logos}
              onChange={this.handleSettingChange.bind(this, 'logo')}
            />
          </div>
        </div>
      );
    }

    if (this.state.selectedWidget === 'chat') {
      form.push(
        <div className={styles.category} key="chat-settings">
          <div className={styles.formGroup}>
            <label>Fade Out Chat</label>
            <ReactSlider
              className={styles.slider}
              thumbClassName={styles.handle}
              defaultValue={this.state.settings.fade_chat}
              min={0}
              max={90}
              onChange={this.handleSettingChange.bind(this, 'fade_chat')}
              renderThumb={(props) => (
                <span {...props}>
                  {this.state.settings.fade_chat ? `${this.state.settings.fade_chat} secs` : 'Off'}
                </span>
              )}
            />
          </div>
        </div>
      );
    }

    if (this.state.selectedWidget === 'voice') {
      form.push(
        <div className={styles.category} key="voice-settings">
          <div className={styles.formGroup}>
            <label>Show Speaking Users Only</label>
            <FormSwitch
              checked={this.state.settings.limit_speaking}
              onChange={() => this.handleToggleSetting('limit_speaking')}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Small Avatars</label>
            <FormSwitch
              checked={this.state.settings.small_avatars}
              onChange={() => this.handleToggleSetting('small_avatars')}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Hide Names</label>
            <FormSwitch
              checked={this.state.settings.hide_names}
              onChange={() => this.handleToggleSetting('hide_names')}
            />
          </div>
          <div className={styles.formGroup}>
            <label>Show My Avatar First</label>
            <FormSwitch
              checked={this.state.settings.streamer_avatar_first}
              onChange={() => this.handleToggleSetting('streamer_avatar_first')}
            />
          </div>
        </div>
      );
    }

    form.push(
      <div className={styles.category} key="text-settings">
        <div className={styles.categoryTitle}>Text Settings</div>
        <div className={styles.formGroup}>
          <label>Text Color</label>
          {this.renderColorPicker('text_color')}
        </div>
        <div className={styles.formGroup}>
          <label>Text Size</label>
          <ReactSlider
            className={styles.slider}
            thumbClassName={styles.handle}
            defaultValue={this.state.settings.text_size}
            min={1}
            max={50}
            onChange={this.handleSettingChange.bind(this, 'text_size')}
            renderThumb={(props) => <span {...props}>{this.state.settings.text_size}px</span>}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Text Outline Color</label>
          {this.renderColorPicker('text_outline_color')}
        </div>
        <div className={styles.formGroup}>
          <label>Text Outline Size</label>
          <ReactSlider
            className={styles.slider}
            thumbClassName={styles.handle}
            defaultValue={this.state.settings.text_outline_size}
            min={0}
            max={50}
            onChange={this.handleSettingChange.bind(this, 'text_outline_size')}
            renderThumb={(props) => <span {...props}>{this.state.settings.text_outline_size}px</span>}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Shadow Color</label>
          {this.renderColorPicker('text_shadow_color')}
        </div>
        <div className={styles.formGroup}>
          <label>Shadow Size</label>
          <ReactSlider
            className={styles.slider}
            thumbClassName={styles.handle}
            defaultValue={this.state.settings.text_shadow_size}
            min={0}
            max={50}
            onChange={this.handleSettingChange.bind(this, 'text_shadow_size')}
            renderThumb={(props) => <span {...props}>{this.state.settings.text_shadow_size}px</span>}
          />
        </div>
      </div>
    );

    form.push(
      <div className={styles.category} key="background-settings">
        <div className={styles.categoryTitle}>Background Settings</div>
        <div className={styles.formGroup}>
          <label>Background Color</label>
          {this.renderColorPicker('bg_color')}
        </div>
        <div className={styles.formGroup}>
          <label>Opacity</label>
          <ReactSlider
            className={styles.slider}
            thumbClassName={styles.handle}
            defaultValue={this.state.settings.bg_opacity}
            min={0.0}
            max={1.0}
            step={0.01}
            onChange={this.handleSettingChange.bind(this, 'bg_opacity')}
            renderThumb={(props) => <span {...props}>{Math.round(this.state.settings.bg_opacity * 100)}%</span>}
          />
        </div>
        <div className={styles.formGroup}>
          <label>Shadow Color</label>
          {this.renderColorPicker('bg_shadow_color')}
        </div>
        <div className={styles.formGroup}>
          <label>Shadow Size</label>
          <ReactSlider
            className={styles.slider}
            thumbClassName={styles.handle}
            defaultValue={this.state.settings.bg_shadow_size}
            min={0}
            max={50}
            onChange={this.handleSettingChange.bind(this, 'bg_shadow_size')}
            renderThumb={(props) => <span {...props}>{this.state.settings.bg_shadow_size}px</span>}
          />
        </div>
      </div>
    );

    return (
      <div className={classNames(styles.form, {[styles.connectNoticeFade]: this.state.connectNotice})}>{form}</div>
    );
  },

  renderConfigLink() {
    const source = this.getSourceInfo();

    if (!source.url) {
      return '';
    }

    return (
      <div className={classNames(styles.configLink, {[styles.connectNoticeFade]: this.state.connectNotice})}>
        {this.renderLivePreview()}
        <div>
          Once you've finished configuring your widget, enter the following URL, width, and height into a&nbsp;
          <strong>{this.state.formType === 'xsplit' ? 'webpage' : 'browser'} source</strong>:
        </div>
        <div>
          <input type="text" readOnly value={source.url} onClick={this.selectAllAndCopy} />
        </div>
        <div className={styles.widthHeight}>
          width: <code>{source.width}</code> px, height: <code>{source.height}</code> px
        </div>
        <div className={styles.helpLink}>
          {/* @ts-expect-error */}
          <a href={HELP_LINKS[this.state.formType]} target="_blank" rel="noreferrer">
            Need installation help?
          </a>
        </div>
      </div>
    );
  },

  renderConnectNotice() {
    return (
      <div className={styles.connectNotice}>
        <div className={styles.title}>Can't Connect to the Discord Client</div>
        It looks like we’re having trouble connecting to your Discord client. Make sure you have Discord installed and
        running on your computer. If you don’t have the app installed you can download it at
        <a href="https://discord.com/download" target="_blank" rel="noreferrer">
          discord.com/download
        </a>
      </div>
    );
  },

  render() {
    const {connectNotice} = this.state;
    return (
      <div className={styles.wrapper}>
        <div className={classNames(styles.landing, {[styles.formOpen]: this.state.showForm})}>
          <div className={styles.landingInner}>
            <div>
              <div className={styles.logo}>
                <img src={discoredStreamkitLogo} alt="Discord" />
                <div>Overlay for OBS &amp; XSplit</div>
              </div>
              <div className={styles.previews}>
                <div className={classNames(styles.preview, styles.status)}>
                  <img src={previewStatusBg} alt="Status" />
                </div>
                <div className={classNames(styles.preview, styles.chat)}>
                  <img src={previewChatBg} alt="Chat" />
                </div>
                <div className={classNames(styles.preview, styles.voice)}>
                  <img src={previewVoiceBg} alt="Voice" />
                </div>
              </div>
              <div className={styles.installButton}>
                <button onClick={() => this.toggleForm('obs')}>Install for OBS</button>
                <button onClick={() => this.toggleForm('xsplit')}>Install for XSplit</button>
              </div>
            </div>
          </div>
          <div className={styles.footer}>Three customizable Discord widgets for your stream.</div>
        </div>
        <div
          className={classNames(styles.install, {[styles.isOpen]: this.state.showForm})}
          onClick={this.isColorPickerShown() ? this.hideColorPickers : null}>
          <div
            className={classNames(styles.close, {[styles.isOpen]: this.state.showForm})}
            onClick={() => this.toggleForm()}>
            <img src={icClose48Px} alt="Close Form" />
          </div>
          <div className={styles.header}>
            <div className={classNames(styles.installLogo, styles[this.state.formType])}></div>
            <div className={styles.widgetSelector}>{this.renderWidgetTypes()}</div>
          </div>
          <div className={styles.content}>
            <div className={styles.centeredContent}>
              {connectNotice ? this.renderConnectNotice() : null}
              {this.renderForm()}
            </div>
          </div>
          {this.renderConfigLink()}
        </div>
      </div>
    );
  },

  isColorPickerShown() {
    for (const key in this.state.displayColorPicker) {
      if (this.state.displayColorPicker[key]) {
        return true;
      }
    }
    return false;
  },

  hideColorPickers() {
    const displayColorPicker = this._hideColorPickers();
    this.setState({displayColorPicker});
  },

  _hideColorPickers() {
    const displayColorPicker: {[key: string]: boolean} = {};
    for (const key in this.state.displayColorPicker) {
      displayColorPicker[key] = false;
    }
    return displayColorPicker;
  },
});

export default Config;
