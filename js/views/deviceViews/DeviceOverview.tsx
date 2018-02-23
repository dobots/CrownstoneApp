import * as React from 'react'; import { Component } from 'react';
import {
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  PixelRatio,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Text,
  View
} from 'react-native';
const Actions = require('react-native-router-flux').Actions;

import {styles, colors, screenWidth, screenHeight, availableScreenHeight} from '../styles'
import { Background } from '../components/Background'
const Swiper = require("react-native-swiper");
import { Util } from "../../util/Util";
import { TopBar } from "../components/Topbar";
import { DeviceBehaviour } from "./elements/DeviceBehaviour";
import { DeviceSummary } from "./elements/DeviceSummary";
import { STONE_TYPES } from "../../router/store/reducers/stones";
import { DeviceError } from "./elements/DeviceError";
import { DeviceUpdate } from "./elements/DeviceUpdate";
import { GuidestoneSummary } from "./elements/GuidestoneSummary";
import { eventBus } from "../../util/EventBus";
import {DevicePowerCurve} from "./elements/DevicePowerCurve";
import {DeviceSchedule} from "./elements/DeviceSchedule";
import {LOG, LOGi} from '../../logging/Log';
import { BATCH } from "../../router/store/storeManager";
import { BatchCommandHandler } from "../../logic/BatchCommandHandler";
import {Permissions} from "../../backgroundProcesses/PermissionManager";
import {DeviceWhatsNew} from "./elements/DeviceWhatsNew";
import {BackAction} from "../../util/Back";
import {MINIMUM_REQUIRED_FIRMWARE_VERSION} from "../../ExternalConfig";

Swiper.prototype.componentWillUpdate = (nextProps, nextState) => {
  eventBus.emit("setNewSwiperIndex", nextState.index);
};

export class DeviceOverview extends Component<any, any> {
  unsubscribeStoreEvents : any;
  unsubscribeSwiperEvents : any = [];
  touchEndTimeout: any;
  summaryIndex : number = 0;
  showWhatsNewVersion : string = null;

  constructor(props) {
    super(props);

    this.state = {swiperIndex: 0, scrolling:false, swipeEnabled: true};
    this.unsubscribeSwiperEvents.push(eventBus.on("setNewSwiperIndex", (nextIndex) => {
      if (this.state.swiperIndex !== nextIndex) {
        this.setState({swiperIndex: nextIndex, scrolling: false});
      }
    }));
    this.unsubscribeSwiperEvents.push(eventBus.on("UIGestureControl", (panAvailable) => {
      if (panAvailable === true && this.state.swipeEnabled === false) {
        this.setState({swipeEnabled: true});
      }
      else  if (panAvailable === false && this.state.swipeEnabled === true) {
        // this is used to move the view back if the user swiped it accidentally
        (this.refs['deviceSwiper'] as any).scrollBy(this.summaryIndex);
        this.setState({swipeEnabled: false});
      }
    }));
  }

  componentWillMount() {
    const state = this.props.store.getState();
    const stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];
    if (stone.config.firmwareVersionSeenInOverview === null) {
      this.props.store.dispatch({
        type: "UPDATE_STONE_LOCAL_CONFIG",
        sphereId: this.props.sphereId,
        stoneId: this.props.stoneId,
        data: {firmwareVersionSeenInOverview: stone.config.firmwareVersion}
      });
    }
  }

  componentDidMount() {
    const { store } = this.props;
    // tell the component exactly when it should redraw
    this.unsubscribeStoreEvents = this.props.eventBus.on("databaseChange", (data) => {
      let change = data.change;

      let state = store.getState();
      if (
        (state.spheres[this.props.sphereId] === undefined) ||
        (change.removeSphere && change.removeSphere.sphereIds[this.props.sphereId]) ||
        (change.removeStone  && change.removeStone.stoneIds[this.props.stoneId])
       ) {
        BackAction();
        return;
      }

      let stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];

      if (!stone || !stone.config) {
        BackAction();
        return;
      }

      let applianceId = stone.config.applianceId;
      if (
        change.changeAppSettings ||
        change.stoneLocationUpdated && change.stoneLocationUpdated.stoneIds[this.props.stoneId] ||
        change.changeStoneState && change.changeStoneState.stoneIds[this.props.stoneId] ||
        change.updateStoneSchedule && change.updateStoneSchedule.stoneIds[this.props.stoneId] ||
        change.powerUsageUpdated && change.powerUsageUpdated.stoneIds[this.props.stoneId] ||
        change.updateStoneConfig && change.updateStoneConfig.stoneIds[this.props.stoneId] ||
        change.updateStoneBehaviour && change.updateStoneBehaviour.stoneIds[this.props.stoneId] ||
        applianceId && change.updateApplianceConfig && change.updateApplianceConfig.applianceIds[applianceId] ||
        applianceId && change.updateApplianceBehaviour && change.updateApplianceBehaviour.applianceIds[applianceId]
        ) {
          this.forceUpdate();
        }
    });
  }

  componentWillUpdate(nextProps, nextState) {
    if (nextState.swiperIndex !== this.summaryIndex) {
      // This will close the connection that is kept open by a dimming command. Dimming is the only command that keeps the connection open.
      // If there is no connection being kept open, this command will not do anything.
      BatchCommandHandler.closeKeptOpenConnection();
    }
  }

  componentWillUnmount() {
    this.unsubscribeStoreEvents();
    this.unsubscribeSwiperEvents.forEach((unsubscribe) => { unsubscribe(); });
    clearTimeout(this.touchEndTimeout);
    // This will close the connection that is kept open by a dimming command. Dimming is the only command that keeps the connection open.
    // If there is no connection being kept open, this command will not do anything.
    BatchCommandHandler.closeKeptOpenConnection();

    const state = this.props.store.getState();
    const sphere = state.spheres[this.props.sphereId];
    if (sphere) {
      const stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];
      if (stone && stone.config.firmwareVersionSeenInOverview !== stone.config.firmwareVersion) {
        this.props.store.dispatch({
          type: "UPDATE_STONE_LOCAL_CONFIG",
          sphereId: this.props.sphereId,
          stoneId: this.props.stoneId,
          data: {firmwareVersionSeenInOverview: stone.config.firmwareVersion}
        });
      }
    }
  }


  render() {
    const state = this.props.store.getState();
    const stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];
    const element = Util.data.getElement(state.spheres[this.props.sphereId], stone);
    let hasAppliance = stone.config.applianceId !== null;

    let summaryIndex = 0;
    let behaviourIndex = summaryIndex + 1;

    this.summaryIndex = summaryIndex;

    let spherePermissions = Permissions.inSphere(this.props.sphereId);


    let whatsNewEnabledFirmwares = {
      '2.0.0': true,
      '2.0.1': true,
    }
    let showWhatsNew = Permissions.inSphere(this.props.sphereId).canUpdateCrownstone &&
                       stone.config.firmwareVersionSeenInOverview &&
                       (stone.config.firmwareVersionSeenInOverview !== stone.config.firmwareVersion) &&
                        whatsNewEnabledFirmwares[stone.config.firmwareVersion];

    if (showWhatsNew) { this.showWhatsNewVersion = stone.config.firmwareVersion; }

    // check what we want to show the user:
    let hasError        = stone.errors.hasError;
    let mustUpdate      = Util.versions.canIUse(stone.config.firmwareVersion, MINIMUM_REQUIRED_FIRMWARE_VERSION) === false;
    let canUpdate       = Permissions.inSphere(this.props.sphereId).canUpdateCrownstone && Util.versions.canUpdate(stone, state) && stone.config.disabled === false;
    let hasBehaviour    = stone.config.type !== STONE_TYPES.guidestone;
    let hasPowerMonitor = stone.config.type !== STONE_TYPES.guidestone;
    let hasScheduler    = stone.config.type !== STONE_TYPES.guidestone;
    let deviceType      = stone.config.type;

    // if this stone requires to be dfu-ed to continue working, block all other actions.
    if (stone.config.dfuResetRequired) {
      canUpdate       = true;
      hasError        = false;
      hasBehaviour    = false;
      hasPowerMonitor = false;
      hasScheduler    = false;
    }

    // only shift the indexes (move the edit button to the next pages) if we do not have a mandatory view
    if (!hasError && !mustUpdate) {
      if (showWhatsNew) { summaryIndex++; behaviourIndex++; }
      if (canUpdate)    { summaryIndex++; behaviourIndex++; }
    }


    let checkScrolling = (newState) => {
      if (this.state.scrolling !== newState) {
        this.setState({scrolling: newState});
      }
    };

    return (
      <Background image={this.props.backgrounds.detailsDark} hideTopBar={true}>
        <TopBar
          leftAction={() => { BackAction(); }}
          rightItem={this.state.scrolling ? this._getScrollingElement() : undefined}
          right={() => {
            switch (this.state.swiperIndex) {
              case summaryIndex:
                return (hasAppliance ? spherePermissions.editAppliance : spherePermissions.editCrownstone) ? 'Edit' : undefined;
              case behaviourIndex:
                return (spherePermissions.changeBehaviour && state.app.indoorLocalizationEnabled) ? 'Change' : undefined;
            }
          }}
          rightAction={() => {
            switch (this.state.swiperIndex) {
              case summaryIndex:
                if ((hasAppliance && spherePermissions.editAppliance) || (!hasAppliance && spherePermissions.editCrownstone)) {
                  Actions.deviceEdit({sphereId: this.props.sphereId, stoneId: this.props.stoneId})
                }
                break;
              case behaviourIndex:
                if (spherePermissions.changeBehaviour && state.app.indoorLocalizationEnabled) {
                  Actions.deviceBehaviourEdit({sphereId: this.props.sphereId, stoneId: this.props.stoneId});
                }
                break;
            }
          }}
          title={element.config.name} />
        <View style={{backgroundColor:colors.csOrange.hex, height:1, width:screenWidth}} />
        <Swiper
          style={swiperStyles.wrapper}
          showsPagination={true}
          height={availableScreenHeight}
          ref="deviceSwiper"
          dot={<View style={{backgroundColor: colors.white.rgba(0.35), width: 8, height: 8,borderRadius: 4, marginLeft: 3, marginRight: 3, marginTop: 3, marginBottom: 3, borderWidth:1, borderColor: colors.black.rgba(0.1)}} />}
          activeDot={<View style={{backgroundColor: colors.white.rgba(1), width: 9, height: 9, borderRadius: 4.5, marginLeft: 3, marginRight: 3, marginTop: 3, marginBottom: 3, borderWidth:1, borderColor: colors.csOrange.rgba(1)}} />}
          loop={false}
          scrollEnabled={this.state.swipeEnabled}
          bounces={true}
          loadMinimal={false}
          onScrollBeginDrag={  () => { checkScrolling(true);  }}
          onTouchEnd={() => { this.touchEndTimeout = setTimeout(() => { checkScrolling(false); }, 400);  }}
        >
          { this._getContent(hasError, canUpdate, mustUpdate, hasBehaviour, hasPowerMonitor, hasScheduler, showWhatsNew, deviceType, stone.config) }
        </Swiper>
      </Background>
    )
  }

  _getScrollingElement() {
    // ios props
    return (
      <View style={{ flex:1, alignItems:'flex-end', justifyContent:'center', paddingTop: 0 }}>
        <ActivityIndicator animating={true} size='small' color={colors.iosBlue.hex} />
      </View>
    )
  }

  _getContent(hasError, canUpdate, mustUpdate, hasBehaviour, hasPowerMonitor, hasScheduler, showWhatsNew, deviceType, stoneConfig) {
    let content = [];
    let props = {store: this.props.store, sphereId: this.props.sphereId, stoneId: this.props.stoneId, eventBus: this.props.eventBus};

    if (hasError) {
      content.push(<DeviceError key={'errorSlide'} {...props} />);
      return content;
    }

    if (mustUpdate) {
      content.push(<DeviceUpdate key={'updateSlide'} mandatory={true} {...props} />);
      return content;
    }

    if (canUpdate) {
      content.push(<DeviceUpdate key={'updateSlide'} mandatory={false} canUpdate={canUpdate} {...props} />);
    }
    if (showWhatsNew) {
      content.push(<DeviceWhatsNew key={'deviceWhatsNewSlide'} {...props} />);
    }

    if (stoneConfig.dfuResetRequired) {
      return content;
    }

    if (deviceType === STONE_TYPES.guidestone) {
      content.push(<GuidestoneSummary key={'summarySlide'}  {...props} />);
    }
    else {
      content.push(<DeviceSummary key={'summarySlide'}  {...props} />);
    }

    if (hasBehaviour) {
      content.push(<DeviceBehaviour key={'behaviourSlide'} {...props} />);
    }

    if (hasScheduler) {
      content.push(<DeviceSchedule key={'scheduleSlide'} {...props} />);
    }

    if (hasPowerMonitor) {
      content.push(<DevicePowerCurve key={'powerSlide'} {...props} />);
    }

    return content;
  }
}

let swiperStyles = StyleSheet.create({
  wrapper: {
  },
  slide1: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide2: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide3: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  }
});

let textColor = colors.white;

export const deviceStyles = StyleSheet.create({
  header: {
    color: textColor.hex,
    fontSize: 25,
    fontWeight:'800'
  },
  errorText: {
    color: textColor.hex,
    fontSize: 16,
    textAlign:'center',
    fontWeight:'600'
  },
  subText: {
    color: textColor.rgba(0.5),
    fontSize: 13,
  },
  explanation: {
    width: screenWidth,
    color: textColor.rgba(0.5),
    fontSize: 13,
    textAlign:'center'
  },
});


