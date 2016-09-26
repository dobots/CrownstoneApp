import { NativeEventsBridge } from './NativeEventsBridge'
import { Scheduler } from '../logic/Scheduler';
import { NativeEvents } from './Proxy';
import { CROWNSTONE_SERVICEDATA_UUID } from '../ExternalConfig';
import { LOG, LOGDebug } from '../logging/Log'
import { getMapOfCrownstonesInAllSpheresByHandle, getMapOfCrownstonesInSphereByCID } from '../util/dataUtil'


let trigger = 'CrownstoneAdvertisement';

class AdvertisementHandlerClass {
  constructor() {
    this.initialized = false;
    this.store = undefined;
    this.referenceMap = {};
    this.referenceCIDMap = {};
    this.activeSphere = '';
  }

  loadStore(store) {
    LOG('LOADED STORE AdvertisementHandlerClass', this.initialized);
    if (this.initialized === false) {
      this.store = store;
      this.init();
    }
  }

  init() {
    if (this.initialized === false) {
      // refresh maps when the database changes
      this.store.subscribe(() => {
        let state = this.store.getState();
        this.activeSphere = state.app.activeSphere;
        this.referenceMap = getMapOfCrownstonesInAllSpheresByHandle(state);
        this.referenceCIDMap = getMapOfCrownstonesInSphereByCID(state, this.activeSphere);
      });

      // create a trigger to throttle the updates.
      Scheduler.setRepeatingTrigger(trigger,{repeatEveryNSeconds:2})

      // listen to verified advertisements. Verified means consecutively successfully encrypted.
      NativeEventsBridge.bleEvents.on(NativeEvents.ble.verifiedAdvertisementData, this.handleEvent.bind(this));
      this.initialized = true;
    }
  }

  handleEvent(advertisement) {
    // service data not available
    if (typeof advertisement.serviceData !== 'object' || typeof advertisement.serviceData[CROWNSTONE_SERVICEDATA_UUID] !== 'object') {
      return;
    }

    // check if we handle setup mode or normal mode packets.
    if (advertisement.serviceData[CROWNSTONE_SERVICEDATA_UUID].setupMode !== true) {
      this._handleNormalMode(advertisement);
    }
    else {
      this._handleSetupMode(advertisement);
    }
  }

  _handleNormalMode(advertisement) {
    LOGDebug(advertisement)

    // only relevant if we are in a sphere.
    if (!(this.activeSphere)) {
      return;
    }

    // the service data in this advertisement;
    let data = advertisement.serviceData[CROWNSTONE_SERVICEDATA_UUID];

    // look for the crownstone in this group which has the same CrownstoneId (CID)
    let refByCID = this.referenceCIDMap[data.crownstoneId];

    // repair mechanism to store the handle.
    if (data.stateOfExternalCrownstone === false && refByCID !== undefined) {
      if (refByCID.handle != advertisement.handle) {
        this.store.dispatch({type: "UPDATE_STONE_CONFIG", sphereId: this.activeSphere, stoneId: refByCID.id, data:{handle: advertisement.handle}});
        return;
      }
    }

    let ref = this.referenceMap[advertisement.handle];
    // unknown crownstone
    if (ref === undefined) {
      return;
    }

    let state = this.store.getState();

    let currentTime = new Date().valueOf();
    let switchState = data.switchState / 128;
    let update = (data) => {
      Scheduler.loadOverwritableAction( trigger, "updateStoneFromAdvertisement_" + advertisement.handle, {
        type: 'UPDATE_STONE_STATE',
        sphereId: this.activeSphere,
        stoneId: ref.id,
        data: { state: switchState, currentUsage: data.powerUsage },
        updatedAt: currentTime
      });
    };

    let stone = state.spheres[this.activeSphere].stones[ref.id];

    if (stone.state.state != switchState) {
      update(data);
    }
    else if (stone.state.currentUsage != data.powerUsage) {
      update(data);
    }
  }

  _handleSetupMode(advertisement) {

  }
}

export const AdvertisementHandler = new AdvertisementHandlerClass();