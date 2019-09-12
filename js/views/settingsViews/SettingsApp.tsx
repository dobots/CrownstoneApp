import { LiveComponent }          from "../LiveComponent";

import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("SettingsApp", key)(a,b,c,d,e);
}
import * as React from 'react';
import {
  ScrollView} from 'react-native';

import { IconButton } from '../components/IconButton'
import { Background } from '../components/Background'
import { Bluenet } from '../../native/libInterface/Bluenet'
import { ListEditableItems } from '../components/ListEditableItems'
import { CLOUD } from '../../cloud/cloudAPI'
import { LOG } from '../../logging/Log'
import {colors, } from '../styles'
import {Util} from "../../util/Util";
import {LocationHandler} from "../../native/localization/LocationHandler";
import { core } from "../../core";
import { TopBarUtil } from "../../util/TopBarUtil";


export class SettingsApp extends LiveComponent<any, any> {
  static options(props) {
    return TopBarUtil.getOptions({title: lang("App_Settings")});
  }

  unsubscribe : any;
  initialKeepAliveState = false;
  triggerTapToToggleCalibration = false;


  _getKeepAliveState() {
    let state = core.store.getState();
    return state.app.indoorLocalizationEnabled && state.app.keepAlivesEnabled;
  }

  componentDidMount() {
    this.unsubscribe = core.eventBus.on("databaseChange", (data) => {
      let change = data.change;
      if (change.changeAppSettings) {
        this.forceUpdate();
      }
    });

    this.initialKeepAliveState = this._getKeepAliveState();
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  
  _getItems() {
    const store = core.store;
    let state = store.getState();

    let items = [];
    items.push({label: lang("FEATURES"), type: 'explanation', below: false});
    items.push({
      label: lang("Use_Tap_To_Toggle"),
      value: state.app.tapToToggleEnabled,
      type: 'switch',
      icon: <IconButton name="md-color-wand" size={22} button={true} color="#fff" buttonStyle={{backgroundColor:colors.green2.hex}} />,
      callback:(newValue) => {
        store.dispatch({
          type: 'UPDATE_APP_SETTINGS',
          data: {tapToToggleEnabled: newValue}
        });
        if (newValue === true) {
          // if we turn it on, we have to setup the training if the user has not already trained this.
          let tapToToggleCalibration = Util.data.getTapToToggleCalibration(state);
          if (!tapToToggleCalibration) {
            this.triggerTapToToggleCalibration = true;
          }
        }
        else {
          this.triggerTapToToggleCalibration = false;
        }
    }});

    if (state.app.tapToToggleEnabled) {
      items.push({
        label: lang("Calibrate_Tap_to_Toggle"),
        type:'button',
        style: {color:'#000'},
        icon: <IconButton name="md-flask" size={22} button={true} color="#fff" buttonStyle={{backgroundColor:colors.menuBackground.hex}} />,
        callback: () => { core.eventBus.emit("CalibrateTapToToggle", {tutorial: this.triggerTapToToggleCalibration}); }
      });
    }

    if (state.app.indoorLocalizationEnabled) {
      items.push({label: lang("Tap_to_toggle_allows_you_"), type: 'explanation', below: true});
    }
    else {
      items.push({label: lang("If_indoor_localization_is"), type: 'explanation', below: true});
    }


    items.push({
      label: lang("Use_Indoor_localization"),
      value: state.app.indoorLocalizationEnabled,
      type: 'switch',
      icon: <IconButton name="c1-locationPin1" size={18} button={true} color="#fff"
                        buttonStyle={{backgroundColor: colors.blue.hex}}/>,
      callback: (newValue) => {
        store.dispatch({
          type: 'UPDATE_APP_SETTINGS',
          data: {indoorLocalizationEnabled: newValue}
        });

        LOG.info("BackgroundProcessHandler: Set background processes to", newValue);
        Bluenet.setBackgroundScanning(newValue);

        if (newValue === false) {
          // REMOVE USER FROM ALL SPHERES AND ALL LOCATIONS.
          let deviceId = Util.data.getCurrentDeviceId(state);
          if (deviceId) {
            CLOUD.forDevice(deviceId).exitSphere("*").catch(() => { });  // will also clear location
          }
        }
      }
    });
    items.push({
      label: lang("Indoor_localization_allow"),
      type: 'explanation',
      below: true
    });
    return items;
  }

  render() {
    return (
      <Background image={core.background.menu} >
                <ScrollView keyboardShouldPersistTaps="always">
          <ListEditableItems items={this._getItems()} separatorIndent={true} />
        </ScrollView>
      </Background>
    );
  }
}
