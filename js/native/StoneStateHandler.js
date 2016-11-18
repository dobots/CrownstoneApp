import { LocationHandler } from '../native/LocationHandler';
import { Scheduler } from '../logic/Scheduler';
import { LOG, LOGDebug } from '../logging/Log'
import { DISABLE_TIMEOUT } from '../ExternalConfig'


/**
 * This class keeps track of the disability state of the crownstone.
 *
 * If a Crownstone is disabled, it means it has not been heard for the last 30 seconds, ibeacon, adv or via mesh.
 */
class StoneStateHandlerClass {
  constructor() {
    this.store = {};
    this.timeoutActions = {};
    this._initialized = false;
  }

  loadStore(store) {
    LOG('LOADED STORE StoneStateHandlerClass', this._initialized);
    if (this._initialized === false) {
      this.store = store;
    }
  }

  receivedIBeaconUpdate(sphereId, stoneId) {
    this.update(sphereId, stoneId);
  }

  receivedUpdate(sphereId, stoneId) {
    this.update(sphereId, stoneId);
  }

  update(sphereId, stoneId) {
    // fallback to ensure we never miss an enter or exit event caused by a bug in ios 10
    LocationHandler.enterSphere(sphereId);

    if (this.timeoutActions[sphereId] === undefined) {
      this.timeoutActions[sphereId] = {};
    }
    if (this.timeoutActions[sphereId][stoneId] === undefined) {
      this.timeoutActions[sphereId][stoneId] = {clearTimeout: undefined};
    }
    else {
      this.timeoutActions[sphereId][stoneId].clearTimeout()
    }

    let disableCallback = () => {
      let state = this.store.getState();
      if (state.spheres[sphereId] && state.spheres[sphereId].stones[stoneId]) {
        // check if there are any stones left that are not disabled.
        let otherStoneIds = Object.keys(state.spheres[sphereId].stones);
        let allDisabled = true;
        otherStoneIds.forEach((otherStoneId) => {
          if (otherStoneId !== stoneId) {
            if (state.spheres[sphereId].stones[otherStoneId].config.disabled === false) {
              allDisabled = false;
            }
          }
        });

        // fallback to ensure we never miss an enter or exit event caused by a bug in ios 10
        if (allDisabled === true) {
          LocationHandler.exitSphere(sphereId);
        }

        this.store.dispatch({
          type: 'UPDATE_STONE_DISABILITY',
          sphereId: sphereId,
          stoneId: stoneId,
          data: {disabled: true}
        });
      }
      delete this.timeoutActions[sphereId][stoneId];
    };

    this.timeoutActions[sphereId][stoneId].clearTimeout = Scheduler.scheduleCallback(disableCallback, DISABLE_TIMEOUT, "disable_" + stoneId + "_");
  }

}

export const StoneStateHandler = new StoneStateHandlerClass();