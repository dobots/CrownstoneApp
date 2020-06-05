import { LiveComponent }          from "../../LiveComponent";

import { Languages } from "../../../Languages"

function lang(key,a?,b?,c?,d?,e?) {
  return Languages.get("SettingsStoneBleDebug", key)(a,b,c,d,e);
}
import * as React from 'react';
import {
  Alert,
  ScrollView,
  Text,
  View
} from "react-native";

import { BackgroundNoNotification } from '../../components/BackgroundNoNotification'
import { ListEditableItems } from '../../components/ListEditableItems'
import { availableScreenHeight, colors, screenWidth } from "../../styles";
import {Util} from "../../../util/Util";
import {Scheduler} from "../../../logic/Scheduler";
import { core } from "../../../core";
import { xUtil } from "../../../util/StandAloneUtil";
import { IconButton } from "../../components/IconButton";
import { NavigationUtil } from "../../../util/NavigationUtil";
import { BatchCommandHandler } from "../../../logic/BatchCommandHandler";
import { DataUtil } from "../../../util/DataUtil";
import { LOGe } from "../../../logging/Log";
import { Graph } from "../../components/graph/Graph";
import { StoneUtil } from "../../../util/StoneUtil";

const triggerId = "SettingsStoneBleDebug";

export class SettingsStoneBleDebug extends LiveComponent<any, any> {
  unsubscribeNative : any[] = [];
  _crownstoneId : number;
  _ibeaconUuid : string;
  _major  : string;
  _minor  : string;
  _handle : string;

  constructor(props) {
    super(props);
    const store = core.store;
    let state = store.getState();
    let sphere = state.spheres[props.sphereId];
    let stone = sphere.stones[props.stoneId];

    this._ibeaconUuid  = sphere.config.iBeaconUUID;
    this._crownstoneId = stone ? stone.config.crownstoneId : null;
    this._major        = stone ? stone.config.iBeaconMajor : null;
    this._minor        = stone ? stone.config.iBeaconMinor : null;
    this._handle       = stone ? stone.config.handle       : null;

    this.state = {
      advertisementPayload: '',
      directAdvertisementPayload: '',
      advertisementStateExternal: false,
      directAdvertisementStateExternal: false,
      advertisementTimestamp: null,
      directAdvertisementTimestamp: null,
      ibeaconPayload: '',
      ibeaconTimestamp: null,
      debugInformationText: null, debugData: null, debugTimestamp: new Date().valueOf(), debugDataHash: null
    };
  }

  componentDidMount() {
    this.unsubscribeNative.push(core.nativeBus.on(core.nativeBus.topics.iBeaconAdvertisement, (data) => { this._parseIBeacon(data) }));
    this.unsubscribeNative.push(core.nativeBus.on(core.nativeBus.topics.advertisement, (data) => { this._parseAdvertisement(data) }));
    Scheduler.setRepeatingTrigger(triggerId, {repeatEveryNSeconds : 1});
    Scheduler.loadCallback(triggerId, () => { this.forceUpdate(); })
  }

  _parseIBeacon(data : ibeaconPackage[]) {
    if (this._major === null && this._minor === null) {
      this.setState({ibeaconPayload: xUtil.stringify(data, 2), ibeaconTimestamp: new Date().valueOf()});
      return
    }

    data.forEach((ibeacon) => {
      if (ibeacon.uuid.toLowerCase() !== this._ibeaconUuid.toLowerCase() ) { return; }
      if (this._major && ibeacon.major !== this._major)                    { return; }
      if (this._minor && ibeacon.minor !== this._minor)                    { return; }

      this.setState({ibeaconPayload: xUtil.stringify(ibeacon, 2), ibeaconTimestamp: new Date().valueOf()});
    })
  }

  _parseAdvertisement(data : crownstoneAdvertisement) {
    if (!data.serviceData) { return; }

    let newData : any = {};
    let changes = false;

    if (data.serviceData.crownstoneId === this._crownstoneId || !this._crownstoneId) {
      newData['advertisementStateExternal'] = data.serviceData.stateOfExternalCrownstone;
      newData["advertisementPayload"] = xUtil.stringify(data, 2);
      newData["advertisementTimestamp"] = new Date().valueOf();
      changes = true;
    }

    if (data.handle === this._handle || !this._handle) {
      newData['directAdvertisementStateExternal'] = data.serviceData.stateOfExternalCrownstone;
      newData["directAdvertisementPayload"] = xUtil.stringify(data, 2);
      newData["directAdvertisementTimestamp"] = new Date().valueOf();
      changes = true;
    }

    if (changes) {
      this.setState(newData);
    }
  }

  componentWillUnmount() {
    Scheduler.removeTrigger(triggerId);
    this.unsubscribeNative.forEach((unsubscribe) => { unsubscribe() });
  }

  _getItems() {
    let items = [];

    const store = core.store;
    let state = store.getState();
    let sphere = state.spheres[this.props.sphereId];
    let stone = sphere.stones[this.props.stoneId];



    items.push({
      label: lang("Get_Behaviour_Debug_Infor"),
      icon: <IconButton name={"md-code-working"} size={25} color={colors.white.hex} buttonStyle={{ backgroundColor: colors.csBlueDark.hex }}/>,
      type: 'navigation',
      callback: () => {
        this.setState({debugInformationText: null, debugData: null});
        core.eventBus.emit("showLoading", "Getting Debug Info...");

        BatchCommandHandler.loadPriority(stone, this.props.stoneId, this.props.sphereId, {commandName: 'getBehaviourDebugInformation'}, {}, 2, "From StoneDebug")
          .then((returnData) => {
            core.eventBus.emit("hideLoading");

            const mapBitmaskArray = (arr) => {
              let result = "None";
              for (let i = 0; i < arr.length; i++) {
                if (result === "None" && arr[i]) {
                  result = i + '';
                }
                else if (arr[i]) {
                  result += ", " + i
                }
              }
              return result;
            }

            let data = returnData.data;

            data.activeBehaviours = mapBitmaskArray(data.activeBehaviours);
            data.activeEndConditions = mapBitmaskArray(data.activeEndConditions);

            data.behavioursInTimeoutPeriod = mapBitmaskArray(data.behavioursInTimeoutPeriod);

            data.presenceProfile_0 = mapBitmaskArray(data.presenceProfile_0);
            data.presenceProfile_1 = mapBitmaskArray(data.presenceProfile_1);
            data.presenceProfile_2 = mapBitmaskArray(data.presenceProfile_2);
            data.presenceProfile_3 = mapBitmaskArray(data.presenceProfile_3);
            data.presenceProfile_4 = mapBitmaskArray(data.presenceProfile_4);
            data.presenceProfile_5 = mapBitmaskArray(data.presenceProfile_5);
            data.presenceProfile_6 = mapBitmaskArray(data.presenceProfile_6);
            data.presenceProfile_7 = mapBitmaskArray(data.presenceProfile_7);

            data.storedBehaviours = mapBitmaskArray(data.storedBehaviours);

            let string = xUtil.stringify(data, 2);
            LOGe.info("STONE DEBUG INFORMATION:", string);
            this.setState({debugInformationText: string});
          })
          .catch((err) => {
            core.eventBus.emit("hideLoading");
            Alert.alert("Something went wrong", err, [{text:"Damn."}]);
          })
        BatchCommandHandler.executePriority()
      }
    });

    items.push({
      label: "Get Crownstone Uptime",
      icon: <IconButton name={"ios-clock"} size={25} color={colors.white.hex} buttonStyle={{ backgroundColor: colors.csBlueDark.hex }}/>,
      type: 'navigation',
      callback: () => {
        this.setState({debugInformationText: null, debugData: null});
        core.eventBus.emit("showLoading", "Getting Crownstone Uptime...");

        BatchCommandHandler.loadPriority(stone, this.props.stoneId, this.props.sphereId, {commandName: 'getCrownstoneUptime'}, {}, 2, "From StoneDebug")
          .then((returnData) => {
            core.eventBus.emit("hideLoading");
            let data = returnData.data;
            LOGe.info("STONE DEBUG INFORMATION: UPTIME", data);
            this.setState({debugInformationText: xUtil.getDurationFormat(data*1000)});
          })
          .catch((err) => {
            core.eventBus.emit("hideLoading");
            Alert.alert("Something went wrong", err, [{text:"Damn."}]);
          })
        BatchCommandHandler.executePriority()
      }
    });

    items.push({
      label: "Get ADC Restarts",
      icon: <IconButton name={"ios-outlet"} size={25} color={colors.white.hex} buttonStyle={{ backgroundColor: colors.csBlueDark.hex }}/>,
      type: 'navigation',
      callback: () => {
        this.setState({debugInformationText: null, debugData: null});
        core.eventBus.emit("showLoading", "Get ADC Restarts...");

        BatchCommandHandler.loadPriority(stone, this.props.stoneId, this.props.sphereId, {commandName: 'getAdcRestarts'}, {}, 2, "From StoneDebug")
          .then((returnData) => {
            core.eventBus.emit("hideLoading");
            let data : AdcRestart = returnData.data;
            LOGe.info("STONE DEBUG INFORMATION: getAdcRestarts", data);
            let resultString = "\n\nRestarts:" + data.restartCount + "\n\nLast ADC restart: " + xUtil.getDateTimeFormat(StoneUtil.crownstoneTimeToTimestamp(data.timestamp))

            this.setState({debugInformationText: resultString});
          })
          .catch((err) => {
            core.eventBus.emit("hideLoading");
            Alert.alert("Something went wrong", err, [{text:"Damn."}]);
          })
        BatchCommandHandler.executePriority()
      }
    });

    items.push({
      label: "Get Switch History",
      icon: <IconButton name={"ios-list-box"} size={25} color={colors.white.hex} buttonStyle={{ backgroundColor: colors.csBlueDark.hex }}/>,
      type: 'navigation',
      callback: () => {
        this.setState({debugInformationText: null, debugData: null});
        core.eventBus.emit("showLoading", "Get switch history...");

        BatchCommandHandler.loadPriority(stone, this.props.stoneId, this.props.sphereId, {commandName: 'getSwitchHistory'}, {}, 2, "From StoneDebug")
          .then((returnData) => {
            core.eventBus.emit("hideLoading");
            let data : SwitchHistory[] = returnData.data;
            LOGe.info("STONE DEBUG INFORMATION: SwitchHistory", data);
            let resultString = "";
            let getSource = function(switchHistory) {
              switch(switchHistory.sourceType) {
                case 0:
                  switch(switchHistory.sourceId) {
                    case 0:
                      return "None";
                    case 2:
                      return "Internal";
                    case 3:
                      return "Uart";
                    case 4:
                      return "Connection";
                    case 5:
                      return "Switchcraft";
                  }
                case 1:
                  return "Behaviour ID: " + switchHistory.sourceId;
                case 3:
                  return "Broadcast DeviceId: " + switchHistory.sourceId;;
              }
            }
            data.forEach((switchHistory) => {
              resultString += xUtil.getDateTimeFormat(StoneUtil.crownstoneTimeToTimestamp(switchHistory.timestamp)) +
                "\n" + switchHistory.switchCommand +
                " -> " + switchHistory.switchState +
                " from:" + getSource(switchHistory) + "\n\n";
            })

            this.setState({debugInformationText: resultString});
          })
          .catch((err) => {
            core.eventBus.emit("hideLoading");
            Alert.alert("Something went wrong", err, [{text:"Damn."}]);
          })
        BatchCommandHandler.executePriority()
      }
    });

    items.push({
      label: "Get Switchcraft Buffers",
      icon: <IconButton name={"md-battery-charging"} size={25} color={colors.white.hex} buttonStyle={{ backgroundColor: colors.csBlueDark.hex }}/>,
      type: 'navigation',
      callback: () => {
        this.setState({debugInformationText: null, debugData: null, debugTimestamp: null, debugDataHash: null});
        core.eventBus.emit("showLoading", "Get Switchcraft Buffers...");

        BatchCommandHandler.loadPriority(stone, this.props.stoneId, this.props.sphereId, {commandName: 'getPowerSamples', triggeredSwitchcraft:true}, {}, 2, "From StoneDebug")
          .then((returnData) => {
            core.eventBus.emit("hideLoading");
            let data : PowerSamples[] = returnData.data;
            LOGe.info("STONE DEBUG INFORMATION: getPowerSamples", data);
            let plotData = [];
            let counter = 0;
            data.forEach((powerSampleSet) => {
              for (let i = 0; i < powerSampleSet.samples.length; i++) {
                plotData.push({x: counter, y: powerSampleSet.multiplier * (powerSampleSet.samples[i] - powerSampleSet.offset)});
              }
              counter += 1;
            })

            this.setState({debugInformationText: null, debugData: plotData, debugTimestamp: returnData.data[0].timestamp, debugDataHash: Math.ceil(Math.random()*1e8).toString(36)});
          })
          .catch((err) => {
            core.eventBus.emit("hideLoading");
            Alert.alert("Something went wrong", err, [{text:"Damn."}]);
          })
        BatchCommandHandler.executePriority()
      }
    });

    if (this.state.debugInformationText) {
      items.push({
        __item:
          <View style={{
            backgroundColor: colors.white.hex,
            minHeight: 300
          }}>
            <Text style={{
              padding: 15,
              color: colors.black.hex,
              fontSize: 12
            }}>{this.state.debugInformationText}</Text>
          </View>
      });
    }

    if (this.state.debugData) {
      items.push({
        __item:
          <View style={{
            backgroundColor: colors.white.hex,
            minHeight: 300
          }}>
            <Text>{ xUtil.getDateTimeFormat(StoneUtil.crownstoneTimeToTimestamp(this.state.debugTimestamp)) }</Text>
            <Graph
              width={screenWidth}
              height={availableScreenHeight/2}
              data={this.state.debugData}
              dataHash={this.state.debugDataHash}
              live={false}
              autofit={true}
              options={{shaded: false, interpolation: false}}
              fade={false}
              showPoints={false}
              lineColor={'red'}
              hideUI={true}
            />
          </View>
      });
    }
    
    


    let largeLabel = 'Examining Sphere';
    if (stone) {
      largeLabel = "Examining \"" + stone.config.name + "\"\nMAC address: \"" + stone.config.macAddress;
    }

    items.push({label: largeLabel, type: 'largeExplanation'});
    items.push({label: lang("iBeacon_UUID___niBeacon_M",this._ibeaconUuid.toUpperCase(),this._major,this._minor, this._handle), type: 'explanation', style: { paddingTop:0, paddingBottom:0 } });
    items.push({label: lang("Latest_iBeacon_data_"), type: 'largeExplanation', style:{paddingTop:0}});
    items.push({__item:
      <View style={{backgroundColor: colors.white.hex, minHeight: 100}}>
        <Text style={{padding:15, color: new Date().valueOf() - this.state.ibeaconTimestamp > 10000 ? colors.gray.hex : colors.black.hex, fontSize:12}}>{ lang("No_Data",this.state.ibeaconPayload) }</Text>
      </View>
    });
    items.push({label: lang("Time_received__no_data",this.state.ibeaconTimestamp,new Date(this.state.ibeaconTimestamp)), type: 'explanation', below: true});

    items.push({label: lang("Green_Background_means_ex"), type: 'largeExplanation'});

    items.push({label: lang("Latest_Direct_Advertiseme"), type: 'largeExplanation'});
    items.push({__item:
        <View style={{backgroundColor: this.state.directAdvertisementStateExternal ? colors.green.rgba(0.1) : colors.white.hex, minHeight: 100}}>
          <Text style={{padding:15, color: new Date().valueOf() - this.state.directAdvertisementTimestamp > 10000 ? colors.gray.hex : colors.black.hex, fontSize:12}}>{ lang("No_Data",this.state.directAdvertisementPayload) }</Text>
        </View>
    });
    items.push({label: lang("Time_received__no_data",this.state.directAdvertisementTimestamp,new Date(this.state.directAdvertisementTimestamp)), type: 'explanation', below: true});


    items.push({label: lang("Latest_Applied_Advertisem"), type: 'largeExplanation'});
    items.push({__item:
        <View style={{backgroundColor: this.state.advertisementStateExternal ? colors.green.rgba(0.1) : colors.white.hex, minHeight: 100}}>
          <Text style={{padding:15, color: new Date().valueOf() - this.state.advertisementTimestamp > 10000 ? colors.gray.hex : colors.black.hex, fontSize:12}}>{ lang("No_Data",this.state.advertisementPayload) }</Text>
        </View>
    });
    items.push({label: lang("Time_received__no_data",this.state.advertisementTimestamp,new Date(this.state.advertisementTimestamp)), type: 'explanation', below: true});



    items.push({ type: 'spacer' });

    return items;
  }

  render() {
    return (
      <BackgroundNoNotification image={core.background.menu} >
        <ScrollView keyboardShouldPersistTaps="always">
          <ListEditableItems items={this._getItems()} separatorIndent={true} />
        </ScrollView>
      </BackgroundNoNotification>
    );
  }
}

