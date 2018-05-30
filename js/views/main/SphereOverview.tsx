import * as React from 'react'; import { Component } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  StyleSheet,
  TouchableHighlight,
  TouchableOpacity,
  Text,
  View
} from 'react-native';
const Actions = require('react-native-router-flux').Actions;
import { SetupStateHandler }                              from '../../native/setup/SetupStateHandler'
import { AnimatedBackground }                             from '../components/animated/AnimatedBackground'
import { Icon }                                           from '../components/Icon'
import { Sphere }                                         from './Sphere'
import { requireMoreFingerprints, enoughCrownstonesForIndoorLocalization, enoughCrownstonesInLocationsForIndoorLocalization } from '../../util/DataUtil'
import { LOG }                        from '../../logging/Log'
import {colors, OrangeLine, screenWidth, topBarHeight} from '../styles'
import { DfuStateHandler } from "../../native/firmware/DfuStateHandler";
import {eventBus} from "../../util/EventBus";
import {Permissions} from "../../backgroundProcesses/PermissionManager";

export class SphereOverview extends Component<any, any> {
  static navigationOptions = ({ navigation }) => {
    const { params } = navigation.state;
    if (params === undefined) { return }

    let paramsToUse = params;
    if (!params.title) {
      if (NAVBAR_PARAMS_CACHE !== null) {
        paramsToUse = NAVBAR_PARAMS_CACHE;
      }
      else {
        paramsToUse = getNavBarParams(params.store.getState(), params);
      }
    }


    return {
      title: paramsToUse.title,
      // headerTitle: <Component /> // used to insert custom header Title component
      // headerLeft: <Component /> // used to insert custom header Left component
      // headerRight: <Component /> // used to insert custom header Right component
      // headerBackImage: require("path to image") // customize back button image
    }
  };

  unsubscribeSetupEvents : any;
  unsubscribeStoreEvents : any;

  constructor(props) {
    super(props);

    this.state = { menuOpen: true };

    this._setActiveSphere();
  }

  componentDidMount() {
    // watch for setup stones
    this.unsubscribeSetupEvents = [];
    this.unsubscribeSetupEvents.push(this.props.eventBus.on("setupStonesDetected",  () => { this.forceUpdate(); }));
    this.unsubscribeSetupEvents.push(this.props.eventBus.on("noSetupStonesVisible", () => { this.forceUpdate(); }));

    // tell the component exactly when it should redraw
    this.unsubscribeStoreEvents = this.props.eventBus.on("databaseChange", (data) => {
      let change = data.change;
      if (change.changeSpheres || change.updateActiveSphere) {
        this._setActiveSphere();
      }

      if (
        change.changeMessageState   ||
        change.changeAppSettings    ||
        change.changeSphereState    ||
        change.changeSphereConfig   ||
        change.stoneLocationUpdated ||
        change.updateSphereUser     ||
        change.updateStoneConfig    ||
        change.updateActiveSphere   ||
        change.updateLocationConfig ||
        change.changeFingerprint    ||
        change.changeSpheres        ||
        change.changeStones         ||
        change.changeLocations
      ) {
        this.forceUpdate();
        this._updateNavBar();
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribeSetupEvents.forEach((unsubscribe) => {unsubscribe();});
    this.unsubscribeStoreEvents();
    NAVBAR_PARAMS_CACHE = null;
  }


  _setActiveSphere() {
    // set the active sphere if needed and setup the object variables.
    let state = this.props.store.getState();
    let activeSphere = state.app.activeSphere;

    let sphereIds = Object.keys(state.spheres).sort((a,b) => {return state.spheres[b].config.name - state.spheres[a].config.name});

    // handle the case where we deleted a sphere that was active.
    if (state.spheres[activeSphere] === undefined) {
      activeSphere = null;
    }
    if (activeSphere === null && sphereIds.length > 0) {
      this.props.store.dispatch({type:"SET_ACTIVE_SPHERE", data: {activeSphere: sphereIds[0]}});
    }

    this._updateNavBar();
  }


  _updateNavBar() {
    let state = this.props.store.getState();
    let params = getNavBarParams(state, this.props);
    this.props.navigation.setParams(params)
  }

  render() {
    LOG.info("RENDERING_OVERVIEW");
    const store = this.props.store;
    const state = store.getState();

    let amountOfSpheres = Object.keys(state.spheres).length;
    let activeSphereId = state.app.activeSphere;
    let background = this.props.backgrounds.main;

    if (amountOfSpheres > 0) {
      let activeSphere = state.spheres[activeSphereId];
      let sphereIsPresent = activeSphere.config.present;

      let noStones = (activeSphereId ? Object.keys(activeSphere.stones).length    : 0) == 0;
      let noRooms  = (activeSphereId ? Object.keys(activeSphere.locations).length : 0) == 0;

      let viewingRemotely = true;
      if (sphereIsPresent || SetupStateHandler.areSetupStonesAvailable() || DfuStateHandler.areDfuStonesAvailable() || (noStones === true && noRooms === true)) {
        viewingRemotely = false;
        background = this.props.backgrounds.main;
      }
      else {
        background = this.props.backgrounds.mainRemoteNotConnected;
      }

      return (
        <View>
          <AnimatedBackground image={background}>
            <OrangeLine/>
            <Sphere sphereId={activeSphereId} store={this.props.store} eventBus={this.props.eventBus} multipleSpheres={amountOfSpheres > 1} />
            { amountOfSpheres > 1 ? <SphereChangeButton viewingRemotely={viewingRemotely} sphereId={activeSphereId} /> : undefined }
            { Permissions.inSphere(activeSphereId).addRoom ? <AddItemButton viewingRemotely={viewingRemotely} sphereId={activeSphereId} /> : undefined }
          </AnimatedBackground>
        </View>
      );
    }
    else {
      return (
        <AnimatedBackground image={background}>
          <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="c1-house" size={150} color={colors.blue.hex}/>
            <Text style={overviewStyles.mainText}>No Spheres available.</Text>
            <Text style={overviewStyles.subText}>Go into the settings to create your own Sphere or wait to be added to those of others.</Text>
          </View>
        </AnimatedBackground>
      );
    }
  }

  _getMailIcon() {
    return (
      <View style={{flex: 1, alignItems: 'flex-start', justifyContent: 'center'}}>
        <Icon name={'md-mail'} size={25} style={{color:colors.white.hex}} />
      </View>
    );
  }



  _finalizeIndoorLocalization(state, activeSphere, sphereIsPresent, noRooms) {
    if (!sphereIsPresent) {
      Alert.alert(
        "You'll have to be in the Sphere to continue.",
        "If you're in range of any of the Crownstones in the sphere, the background will turn blue and you can start teaching your house to find you!",
        [{text: 'OK'}]
      );
    }
    else if (noRooms) {
      Alert.alert(
        "Let's create some rooms!",
        "Tap the icon on the right to add a room!",
        [{text: 'OK'}]
      );
    }
    else if (enoughCrownstonesInLocationsForIndoorLocalization(state, activeSphere)) {
      this.props.eventBus.emit("showLocalizationSetupStep2", activeSphere);
    }
    else {
      Actions.roomOverview({
        sphereId: activeSphere,
        locationId: null,
        title: 'First things first :)',
        hideRight: true,
        usedForIndoorLocalizationSetup: true,
        overlayText:'Place your Crownstones in rooms!',
        explanation: 'Tap a Crownstone to see the options, then tap the left icon to select a room!'
      });
    }
  }
}

function getNavBarParams(state, props) {
  LOG.info("UPDATING SPHERE OVERVIEW NAV BAR");
  let sphereIds = Object.keys(state.spheres);
  let amountOfSpheres = sphereIds.length;

  let blockAddButton = false;
  let activeSphereId = state.app.activeSphere;

  if (amountOfSpheres > 0) {
    let activeSphere = state.spheres[activeSphereId];
    if (activeSphere === undefined) {
      activeSphere = state.spheres[sphereIds[0]]
    }

    let sphereIsPresent = activeSphere.config.present;

    // are there enough in total?
    let enoughCrownstonesForLocalization = enoughCrownstonesForIndoorLocalization(state, activeSphereId);

    // do we need more fingerprints?
    let requiresFingerprints = requireMoreFingerprints(state, activeSphereId);

    let noStones = (activeSphereId ? Object.keys(activeSphere.stones).length : 0) == 0;
    let noRooms = (activeSphereId ? Object.keys(activeSphere.locations).length : 0) == 0;


    let spherePermissions = Permissions.inSphere(activeSphereId);

    let showFinalizeIndoorNavigationButton = (
      state.app.indoorLocalizationEnabled &&
      spherePermissions.doLocalizationTutorial &&
      sphereIsPresent === false && // only show this if you're there.
      enoughCrownstonesForLocalization === true && // Have 4 or more crownstones
      (noRooms === true || requiresFingerprints === true)  // Need more fingerprints.
    );


    let showFinalizeIndoorNavigationCallback = () => {
      this._finalizeIndoorLocalization(state, activeSphereId, sphereIsPresent, noRooms);
    };
    let showMailIcon = activeSphere.config.newMessageFound;

    NAVBAR_PARAMS_CACHE = {
      title: activeSphere.config.name,
      showFinalizeNavigationButton: showFinalizeIndoorNavigationButton,
      showAdd: !noStones && spherePermissions.addRoom && !blockAddButton,
      showHamburgerMenu: true,
      activeSphereId: activeSphereId
    }
  }
  else {
    NAVBAR_PARAMS_CACHE = {
      title: "Hello there!",
      showFinalizeNavigationButton: false,
      showAdd: false,
      showHamburgerMenu: true
    }
  }

  return NAVBAR_PARAMS_CACHE;
}

let NAVBAR_PARAMS_CACHE = null;




class SphereChangeButton extends Component<any, any> {
  render() {
    let outerRadius = 0.11*screenWidth;
    let size = 0.084*screenWidth;
    let color = this.props.viewingRemotely === false ? colors.menuBackground.rgba(0.75) : colors.notConnected.hex;
    return (
      <TouchableOpacity style={{
        position:'absolute',
        top: 0,
        left: 0,
        padding: 6,
        paddingRight:10,
        paddingBottom:10,
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'center',
      }}
      onPress={() => { eventBus.emit('showSphereSelectionOverlay'); }}>
        <View style={{
          width: outerRadius,
          height:outerRadius,
          borderRadius:0.5*outerRadius,
          backgroundColor: colors.white.rgba(0.5),
          alignItems:'center',
          justifyContent:'center',
        }}>
          <Icon name="c1-sphere" size={size} color={ color } />
        </View>
      </TouchableOpacity>
    );
  }
}

class AddItemButton extends Component<any, any> {
  render() {
    let outerRadius = 0.11*screenWidth;
    let size = 0.083*screenWidth;
    let color = this.props.viewingRemotely === false ? colors.menuBackground.rgba(0.75) : colors.notConnected.hex;
    return (
      <TouchableOpacity style={{
        position:'absolute',
        bottom: 0,
        right: 0,
        padding: 6,
        paddingLeft:10,
        paddingTop:10,
        flexDirection:'row',
        alignItems:'center',
        justifyContent:'center',
      }}
        onPress={() => { Actions.addItemsToSphere({sphereId: this.props.sphereId}) }}>
        <View style={{
          width: outerRadius,
          height:outerRadius,
          borderRadius:0.5*outerRadius,
          backgroundColor: colors.white.rgba(0.5),
          alignItems:'center',
          justifyContent:'center',
        }}>
          <Icon name="c3-addRounded" size={ size } color={ color } />
        </View>
      </TouchableOpacity>
    );
  }
}

export const overviewStyles = StyleSheet.create({
  mainText: {
    backgroundColor: 'transparent',
    textAlign: 'center',
    color: colors.menuBackground.hex,
    fontSize: 25,
    fontWeight: 'bold',
    padding: 15,
    paddingBottom: 0
  },
  subText: {
    backgroundColor: 'transparent',
    textAlign: 'center',
    color: colors.menuBackground.hex,
    fontSize: 15,
    padding: 15,
    paddingBottom: 0
  },
  subTextSmall: {
    backgroundColor: 'transparent',
    textAlign: 'center',
    color: colors.menuBackground.rgba(0.4),
    fontSize: 12,
    padding: 30,
    paddingBottom: 0
  },
  bottomText: {
    backgroundColor:'transparent',
    color: colors.darkGreen.hex,
    fontSize:12,
    padding:3
  },
  swipeButtonText: {
    backgroundColor: 'transparent',
    fontSize: 40,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    alignItems: 'center'
  }
});


