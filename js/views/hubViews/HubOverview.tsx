import { LiveComponent }          from "../LiveComponent";

import { Languages } from "../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("HubOverview", key)(a,b,c,d,e);
}
import * as React from 'react';

import { Background } from '../components/Background'
import { BatchCommandHandler }  from "../../logic/BatchCommandHandler";
import { SphereDeleted }        from "../static/SphereDeleted";
import { StoneDeleted }         from "../static/StoneDeleted";
import { core } from "../../core";
import { TopBarUtil } from "../../util/TopBarUtil";
import { StoneUtil } from "../../util/StoneUtil";
import { INTENTS } from "../../native/libInterface/Constants";
import { availableScreenHeight, colors, deviceStyles, screenHeight, screenWidth, styles } from "../styles";
import {
  ActivityIndicator, Alert,
  Text,
  TextStyle,
  TouchableHighlight,
  TouchableOpacity,
  View,
  ViewStyle
} from "react-native";
import { StoneAvailabilityTracker } from "../../native/advertisements/StoneAvailabilityTracker";
import { Icon } from "../components/Icon";
import { NavigationUtil } from "../../util/NavigationUtil";
import { xUtil } from "../../util/StandAloneUtil";
import { Permissions } from "../../backgroundProcesses/PermissionManager";
import { DimmerSlider, DIMMING_INDICATOR_SIZE, DIMMING_INDICATOR_SPACING } from "../components/DimmerSlider";
import { AnimatedCircle } from "../components/animated/AnimatedCircle";
import { LockedStateUI } from "../components/LockedStateUI";
import { STONE_TYPES } from "../../Enums";
import { MapProvider } from "../../backgroundProcesses/MapProvider";
import { Navigation } from "react-native-navigation";
import { Util } from "../../util/Util";
import { MINIMUM_REQUIRED_FIRMWARE_VERSION } from "../../ExternalConfig";
import { AlternatingContent } from "../components/animated/AlternatingContent";
import { HubHelper } from "../../native/setup/HubHelper";
import { BluenetPromise, BluenetPromiseWrapper } from "../../native/libInterface/BluenetPromise";
import { DataUtil } from "../../util/DataUtil";
import { Button } from "../components/Button";
import { Get } from "../../util/GetUtil";
import { HubReplyError } from "./HubEnums";
import { LOG, LOGe, LOGi } from "../../logging/Log";
import { Scheduler } from "../../logic/Scheduler";
import { CLOUD } from "../../cloud/cloudAPI";
import { HubSyncer } from "../../cloud/sections/newSync/syncers/HubSyncerNext";


export class HubOverview extends LiveComponent<any, { fixing: boolean }> {
  static options(props) {
    getTopBarProps(props);
    return TopBarUtil.getOptions(NAVBAR_PARAMS_CACHE);
  }

  unsubscribeStoreEvents;


  constructor(props) {
    super(props);

    const stone = Get.stone(this.props.sphereId, this.props.stoneId);
    if (stone) {
      if (stone.config.firmwareVersionSeenInOverview === null) {
        core.store.dispatch({
          type: "UPDATE_STONE_LOCAL_CONFIG",
          sphereId: this.props.sphereId,
          stoneId: this.props.stoneId,
          data: { firmwareVersionSeenInOverview: stone.config.firmwareVersion }
        });
      }
    }

    this.state = {fixing: false}
  }

  navigationButtonPressed({ buttonId }) {
    if (buttonId === 'deviceEdit') {
      if (this.props.stoneId) {
        NavigationUtil.launchModal("DeviceEdit", { sphereId: this.props.sphereId, stoneId: this.props.stoneId });
      }
      else if (this.props.hubId) {
        NavigationUtil.launchModal("HubEdit", { sphereId: this.props.sphereId, hubId: this.props.hubId });
      }
    }
  }

  componentDidMount() {
    let state = core.store.getState();

    if (state.app.hasSeenDeviceSettings === false) {
      core.store.dispatch({ type: 'UPDATE_APP_SETTINGS', data: { hasSeenDeviceSettings: true } })
    }

    this.unsubscribeStoreEvents = core.eventBus.on("databaseChange", (data) => {
      let change = data.change;
      let state = core.store.getState();
      if (
        (state.spheres[this.props.sphereId] === undefined) ||
        (change.removeSphere         && change.removeSphere.sphereIds[this.props.sphereId]) ||
        (change.removeStone          && change.removeStone.stoneIds[this.props.stoneId])
      ) {
        return this.forceUpdate();
      }

      let stone = state.spheres[this.props.sphereId].stones[this.props.stoneId];
      if (!stone || !stone.config) { return; }

      if (
        !change.removeStone &&
        (
          change.updateHubConfig ||
          change.changeHubs ||
          change.changeAppSettings ||
          change.stoneLocationUpdated    && change.stoneLocationUpdated.stoneIds[this.props.stoneId]    ||
          change.changeStoneAvailability && change.changeStoneAvailability.stoneIds[this.props.stoneId] ||
          change.updateStoneConfig       && change.updateStoneConfig.stoneIds[this.props.stoneId]
        )
      ) {
        if (change.updateStoneConfig && change.updateStoneConfig.stoneIds[this.props.stoneId]) {
          this._updateNavBar();
        }
        this.forceUpdate();
        return
      }
    });
  }

  _updateNavBar() {
    getTopBarProps(this.props);
    Navigation.mergeOptions(this.props.componentId, TopBarUtil.getOptions(NAVBAR_PARAMS_CACHE))
  }

  componentWillUnmount() {
    this.unsubscribeStoreEvents();
    // This will close the connection that is kept open by a dimming command. Dimming is the only command that keeps the connection open.
    // If there is no connection being kept open, this command will not do anything.

    const state = core.store.getState();
    const sphere = state.spheres[this.props.sphereId];
    if (sphere) {
      const stone = sphere.stones[this.props.stoneId];
      if (stone && stone.config.firmwareVersionSeenInOverview !== stone.config.firmwareVersion) {
        core.store.dispatch({
          type: "UPDATE_STONE_LOCAL_CONFIG",
          sphereId: this.props.sphereId,
          stoneId: this.props.stoneId,
          data: { firmwareVersionSeenInOverview: stone.config.firmwareVersion }
        });
      }
    }
  }


  _getDebugIcon(stone) {
    let wrapperStyle : ViewStyle = {
      width: 35,
      height: 35,
      position: 'absolute',
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: "center"
    };
    return (
      <TouchableOpacity
        onPress={() => { NavigationUtil.navigate( "SettingsStoneBleDebug",{sphereId: this.props.sphereId, stoneId: this.props.stoneId}) }}
        style={wrapperStyle}>
        <Icon name={"ios-bug"} color={colors.csBlueDarker.rgba(0.5)} size={30} />
      </TouchableOpacity>
    );
  }



  _getStoneIcon(stone, updateAvailable) {
    let iconColor = colors.white.rgba(1);
    let size = 0.25*availableScreenHeight;
    let stateColor = colors.green.hex;
    let icon = stone?.config?.icon || 'c1-router';

    if (updateAvailable) {
      return (
        <TouchableOpacity
          style={{width: screenWidth, height:size, alignItems:'center', justifyContent:'center'}}
          onPress={() => {
            NavigationUtil.launchModal( "DfuIntroduction", {sphereId: this.props.sphereId});
          }}
        >
          <AlternatingContent
            style={{width:screenWidth, height:size, justifyContent:'center', alignItems:'center'}}
            fadeDuration={500}
            switchDuration={2000}
            contentArray={[
              <DeviceIcon size={size} color={stateColor} iconColor={iconColor} icon={"c1-update-arrow"} />,
              <DeviceIcon size={size} color={stateColor} iconColor={iconColor} icon={icon} />,
            ]}
          />
        </TouchableOpacity>
      );
    }


    return (
      <View style={{width: screenWidth, height:size, alignItems:'center', justifyContent:'center'}}>
        <DeviceIcon size={size} color={stateColor} iconColor={iconColor} icon={icon} />
      </View>
    )
  }



  getStateEntries(stone: StoneData | null, hub: FoundHubResult | null, hubs: FoundHubResult[]) {
    let entries = [];
    let index = 5000;
    let textStyle : TextStyle = {textAlign:'center', fontSize:16, fontWeight:'bold'};
    let hubState = hub?.data?.state;
    let helper = new HubHelper();

    const createHub = async () => {
      try {
        LOGi.info("Setting up hub...")
        let hubId;
        try {
          hubId = await helper.setup(this.props.sphereId, this.props.stoneId)
        }
        catch(err) {
          // if this hub is not in setup mode anymore, attempt to initalize it.
          if (err?.errorType === HubReplyError.NOT_IN_SETUP_MODE) {
            hubId = await helper.setUartKey(this.props.sphereId, this.props.stoneId);
          }
        }
        core.store.dispatch({
          type: "UPDATE_HUB_CONFIG",
          sphereId: this.props.sphereId,
          hubId: hubId,
          data: { locationId: stone.config.locationId }
        });
      }
      catch(err) {
        LOGe.info("Problem settings up new hub", err);
        Alert.alert("Something went wrong...","Please try again later!", [{text:"OK"}]);
      }
      this.setState({ fixing: false });
    }

    if (this.state.fixing) {
      return <View key={"Fixing"} style={{...styles.centered, flex:1, padding:15}}>
        <Text style={textStyle}>{"Fixing issue..."}</Text>
        <View style={{flex:0.25}}/>
        <ActivityIndicator size={'large'} />
        <View style={{flex:1}}/>
      </View>
    }


    if (!stone) {
      return (
        <View key={"StoneMissingFix"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"This hub has no Crownstone Dongle linked to it. " +
          "You can resolve this by setting up the CrownstoneUSB dongle in this hub or removing this hub from the Sphere.\n\nIf the usb dongle is already setup, find it in the app and press the fix now button over there."}</Text>
          <View style={{flex:1}}/>
        </View>
      );
    }

    // this means the hub itself has no reference in the app to work off from. We should fix this.
    if (!hub) {
      return (
        <View key={"HubReferenceFix"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"The hub reference in the app is missing. Press the button below to fix this!"}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Fix now. "}
            icon={"ios-build"}
            iconSize={14}
            callback={() => {
              this.setState({fixing: true});
              helper.createLocalHubInstance(this.props.sphereId, this.props.stoneId)
                .then((hubId) => {
                  core.store.dispatch({type:"UPDATE_HUB_CONFIG", sphereId: this.props.sphereId, hubId: hubId, data: {locationId: stone.config.locationId}});
                  this.setState({fixing:false})
                })
                .catch(async (err) => {
                  if (err === "HUB_REPLY_TIMEOUT") {
                    Alert.alert("Something went wrong...","The hub connected to this dongle is not responding. Please disconnect the hub's power, wait 5 seconds and plug it back in. After 1 minute, try again.", [{text:"OK"}]);
                  }
                  else if (typeof err === 'object') {
                    if (err.code === 3) {
                      if (err.errorType === HubReplyError.IN_SETUP_MODE) {
                        await createHub();
                        await Scheduler.delay(5000);
                      }
                    }
                    else {
                      throw err;
                    }
                  }
                  else {
                    throw err;
                  }
                  this.setState({fixing:false})
                })
                .catch((err) => {
                  Alert.alert("Something went wrong...","Please try again later!", [{text:"OK"}]);
                  this.setState({fixing:false})
                })
            }}
          />
        </View>
      );
    }



    if (hubState.uartAlive === false && this.props.stoneId) {
      return (
        <View key={"HubUartFailed"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"The hub is not responding to the Crownstone USB dongle. Check if it is connected and working!"}</Text>
          <View style={{flex:1}}/>
        </View>
      );
    }

    // this means the dongle is set up, but the hub itself is not setup.
    if (hubState.hubHasBeenSetup === false) {
      return (
        <View key={"HubSetupFix"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"The hub itself is not initialized yet.. Press the button below to fix this!"}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Initialize hub!"}
            icon={"ios-build"}
            iconSize={14}
            callback={async () => {
              this.setState({ fixing: true });
              await createHub();
            }}
          />
        </View>
      );
    }

    if (hubs.length > 1) {
      return (
        <View key={"HubMultiple"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"There are multiple hubs bound to this reference... Press the button below to fix this!"}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Fix it!"}
            icon={"ios-build"}
            iconSize={14}
            callback={async () => {
              this.setState({fixing:true});
              try {
                let requestCloudId = await helper.getCloudIdFromHub(this.props.sphereId, this.props.stoneId);
                for (let item of hubs) {
                  if (requestCloudId && item?.data?.config?.cloudId !== requestCloudId) {
                    if (item?.data?.config?.cloudId) {
                      try { await CLOUD.deleteHub(item.data.config.cloudId); } catch (e) { }
                    }
                    core.store.dispatch({type:"REMOVE_HUB", sphereId: this.props.sphereId, hubId: item.id});
                  }
                }
              }
              catch(err) {
                Alert.alert("Something went wrong...","Please try again later!", [{text:"OK"}]);
              }
              this.setState({fixing:false});
            }}
          />
        </View>
      );
    }



    if (hubState.uartAlive === true && hubState.uartAliveEncrypted === false && hubState.uartEncryptionRequiredByCrownstone === true && hubState.uartEncryptionRequiredByHub === true) {
      return (
        <View key={"HubUartEncryptionFailed"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"This hub does not belong to your Sphere. The hub must be factory reset and setup again to resolve this. Press the button below to do this."}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Factory reset hub. "}
            icon={"ios-build"}
            iconSize={14}
            callback={async () => {
              this.setState({fixing: true});
              try {
                await helper.factoryResetHubOnly(this.props.sphereId, this.props.stoneId);
                await helper.setup(this.props.sphereId, this.props.stoneId);
              }
              catch(e) {
                Alert.alert("Something went wrong...","Please try again later!", [{text:'OK'}])
              }
              this.setState({fixing:false})
            }}
          />
        </View>
      );
    }


    if (hubState.uartAlive === true && hubState.uartAliveEncrypted === false && hubState.uartEncryptionRequiredByCrownstone === false && hubState.uartEncryptionRequiredByHub === true) {
      return (
        <View key={"HubUartEncryptionDisabled"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"Encryption is not enabled yet. Tap the button below to fix this!"}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Enable encryption. "}
            icon={"ios-build"}
            iconSize={14}
            callback={ async () => {
              this.setState({fixing: true});
              try {
                await helper.setUartKey(this.props.sphereId, this.props.stoneId);
              }
              catch(e) {
                Alert.alert("Something went wrong...","Please try again later!", [{text:'OK'}])
              }
              this.setState({fixing:false})
            }}
          />
        </View>
      );
    }


    if (!hub.data.config.cloudId) {
      return (
        <View key={"HubCloudMissing"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"This hub does not exist in the cloud... Press the button below to fix this!"}</Text>
          <View style={{flex:1}}/>
          <Button
            backgroundColor={colors.blue.rgba(0.5)}
            label={ "Fix it!"}
            icon={"ios-build"}
            iconSize={14}
            callback={async () => {
              this.setState({fixing:true});
              try {
                let requestCloudId = await helper.getCloudIdFromHub(this.props.sphereId, this.props.stoneId);
                let existingHub = DataUtil.getHubByCloudId(this.props.sphereId, requestCloudId);

                if (existingHub) {
                  // we actually have the requested hub in our local database. Delete the one without cloudId, and bind the other to this Crownstone.
                  core.store.batchDispatch([
                    {type:"REMOVE_HUB", sphereId: this.props.sphereId, hubId: hub.id},
                    {type:"UPDATE_HUB_CONFIG", sphereId: this.props.sphereId, hubId: hub.id, data: {linkedStoneId: this.props.stoneId, locationId: stone.config.locationId}},
                  ]);
                  return;
                }

                // we dont have it locally, look in the cloud.
                try {
                  let hubCloudData = await CLOUD.getHub(requestCloudId);
                  // we have it in the cloud, store locally
                  core.store.batchDispatch([
                    {type:"REMOVE_HUB", sphereId: this.props.sphereId, hubId: hub.id},
                    {type:"ADD_HUB", sphereId: this.props.sphereId, hubId: xUtil.getUUID(), data: HubSyncer.mapCloudToLocal(hubCloudData, this.props.stoneId, stone.config.locationId)},
                  ]);
                }
                catch (err) {
                  console.log("HERE", err)
                  if (err?.status === 404) {
                    // this item does not exist  in the cloud.. Factory reset required.
                    core.store.dispatch({ type: "REMOVE_HUB", sphereId: this.props.sphereId, hubId: hub.id });
                    await helper.factoryResetHubOnly(this.props.sphereId, this.props.stoneId);
                    await helper.setup(this.props.sphereId, this.props.stoneId);
                  }
                  else {
                    throw err;
                  }
                }
                this.setState({fixing:false});
              }
              catch(err) {
                console.log("ERORR", err)
                Alert.alert("Something went wrong...","Please try again later!", [{text:"OK"}]);
                this.setState({fixing:false});
              }
            }}
          />
        </View>
      );
    }


    if (hubState.hubHasInternet === false) {
      return (
        <View key={"HubNoInternet"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"The hub is not connected to the internet. Please reconnect the hub to the internet."}</Text>
          <View style={{flex:1}}/>
        </View>
      );
    }

    if (hubState.hubHasError) {
      return (
        <View key={"Hub Reports Error"} style={{...styles.centered, flex:1, padding:15}}>
          <Text style={textStyle}>{"The hub is reporting an error..."}</Text>
          <View style={{flex:1}}/>
        </View>
      );
    }

    if (hubState.uartAlive && hubState.uartAliveEncrypted) {
      if (hub.data.config.ipAddress) {
        return (
          <View key={"HubIPAddress"} style={{...styles.centered, flex:1, padding:15}}>
            <Text style={textStyle}>{"Everything is looking good!\n\nThe address of this hub on your local network is:\n"}</Text>
            <Text style={{...textStyle, fontSize: 20}}>{hub.data.config.ipAddress}</Text>
            <View style={{flex:1}}/>
          </View>
        )
      }
      else {
        return (
          <View key={"HubOK"} style={{...styles.centered, flex:1, padding:15}}>
            <Text style={textStyle}>{"Everything is looking good!"}</Text>
            <View style={{flex:1}}/>
          </View>
        )
      }
    }

    return entries;
  }

  render() {
    const state = core.store.getState();
    const sphere = state.spheres[this.props.sphereId];
    if (!sphere) {
      return <SphereDeleted/>
    }
    const stone = sphere.stones[this.props.stoneId];
    const hubs = DataUtil.getAllHubsWithStoneId(this.props.sphereId, this.props.stoneId);
    let hub = DataUtil.getHubByStoneId(this.props.sphereId, this.props.stoneId);
    if (!hub) {
      let directHub = DataUtil.getHubById(this.props.sphereId, this.props.hubId);
      if (directHub) {
        hub = {id:this.props.hubId, data:directHub};
      }
    }

    let updateAvailable = stone && stone.config.firmwareVersion && ((Util.canUpdate(stone, state) === true) || xUtil.versions.canIUse(stone.config.firmwareVersion, MINIMUM_REQUIRED_FIRMWARE_VERSION) === false);


    return (
      <Background image={core.background.lightBlur}>
        <View style={{flex:0.5}} />

        {/*{ <View style={{padding:30}}><Text style={deviceStyles.header}>{ "Hub state overview:" }</Text></View> }*/}

        { this._getStoneIcon(stone, updateAvailable) }
        <View style={{width:screenWidth, padding:30, ...styles.centered}}>
          <Text style={deviceStyles.subHeader}>{"Hub information:"}</Text>
        </View>

        {this.getStateEntries(stone, hub, hubs)}


        { state.user.developer ? this._getDebugIcon(stone) : undefined }
      </Background>
    )
  }
}

export function DeviceIcon({ size, color, iconColor, icon}) {
  let borderWidth = size*0.04;
  let innerSize = size-1.5*borderWidth;
  return (
    <AnimatedCircle size={size} color={color} style={{alignItems:'center', justifyContent:'center'}}>
      <AnimatedCircle size={innerSize} color={color} style={{borderRadius:0.5*innerSize, borderWidth: borderWidth, borderColor: iconColor, alignItems:'center', justifyContent:'center'}}>
        <Icon size={innerSize*0.63} name={icon} color={iconColor} />
      </AnimatedCircle>
    </AnimatedCircle>
  );
}

function getTopBarProps(props) {
  const state = core.store.getState();
  const hub = state.spheres[props.sphereId].hubs[props.hubId];
  const stone = state.spheres[props.sphereId].stones[props.stoneId];
  let spherePermissions = Permissions.inSphere(props.sphereId);

  NAVBAR_PARAMS_CACHE = {
    title: stone?.config?.name ?? hub?.config?.name,
  }

  if (spherePermissions.editCrownstone) {
    NAVBAR_PARAMS_CACHE["nav"] = {
      id: 'deviceEdit',
      text:  lang("Edit"),
    }
  }

  return NAVBAR_PARAMS_CACHE;
}


/**
 * this will store the switchstate if it is not already done. Used for dimmers which use the "TRANSIENT" action.
 */
export function safeStoreUpdate(sphereId, stoneId, storedSwitchState) {
  const state = core.store.getState();
  const sphere = state.spheres[sphereId];
  if (!sphere) { return storedSwitchState; }

  const stone = sphere.stones[stoneId];
  if (!stone) { return storedSwitchState; }

  if (stone.state.state !== storedSwitchState) {
    let data = {state: stone.state.state};
    if (stone.state.state === 0) {
      data['currentUsage'] = 0;
    }
    core.store.dispatch({
      type: 'UPDATE_STONE_SWITCH_STATE',
      sphereId: sphereId,
      stoneId: stoneId,
      data: data
    });

    return stone.state.state;
  }

  return storedSwitchState;
}

let NAVBAR_PARAMS_CACHE : topbarOptions = null;