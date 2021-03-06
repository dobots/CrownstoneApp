import {LOG, LOGe} from "../logging/Log";
import { Util } from "../util/Util";
import { core } from "../core";
import { StoneAvailabilityTracker } from "../native/advertisements/StoneAvailabilityTracker";
import { from, tell } from "../logic/constellation/Tellers";

class FirmwareWatcherClass {
  _initialized: boolean = false;

  init() {
    LOG.info('LOADED STORE FirmwareWatcher', this._initialized);
    if (this._initialized === false) {
      // once the user is logged in, we will check if there are crownstones that we do not know the firmware of.

      core.eventBus.on('enterSphere', (sphereId) => { this.checkFirmware(sphereId); });
    }
    this._initialized = true;
  }

  checkFirmware(sphereId) {
    LOG.info("FirmwareWatcher: Starting Firmware Check");

    let state = core.store.getState();
    if (!state.spheres[sphereId]) {
      LOGe.info("FirmwareWatcher: Can not find this Sphere in the state.", sphereId);
      return;
    }

    let loadedCommands = false;
    let randomCheck = Math.random() < 0.025;
    if (randomCheck) {
      LOG.info("FirmwareWatcher: Random Firmware Check Forced.");
    }

    Util.data.callOnStonesInSphere(sphereId, (stoneId, stone) => {
      let execute = !stone.config.firmwareVersion || stone.config.firmwareVersion === '0' || randomCheck  || !stone.config.hardwareVersion || stone.config.hardwareVersion === '0'

      LOG.info("FirmwareWatcher: Looping over stones:", stoneId, " has: fw", stone.config.firmwareVersion, 'hardware:', stone.config.hardwareVersion, "Will execute when in range:", execute);
      // random chance to check the firmware again.
      if (execute) {
        from(stone, 3000).getFirmwareVersion()
          .then((firmwareVersion : string) => {
            core.store.dispatch({
              type:     "UPDATE_STONE_CONFIG",
              stoneId:  stoneId,
              sphereId: sphereId,
              data: {
                firmwareVersion: firmwareVersion
              }
            });
          })
          .catch((err) => { LOGe.info("FirmwareWatcher: Failed to get firmware version from stone.", err)});

        from(stone, 3000).getHardwareVersion()
          .then((hardwareVersion : string) => {
            core.store.dispatch({
              type: "UPDATE_STONE_CONFIG",
              stoneId: stoneId,
              sphereId: sphereId,
              data: {
                hardwareVersion: hardwareVersion
              }
            });
          })
          .catch((err) => { LOGe.info("FirmwareWatcher: Failed to get hardware version from stone.", err) });

        loadedCommands = true;
      }
    });

    if (loadedCommands) {
      LOG.info("FirmwareWatcher: Firmware commands loaded into BatchCommandHandler. These will fire when the required Crownstone is in range.");
    }
    else {
      LOG.info("FirmwareWatcher: No need to run a firmware/hardware version check.");
    }
  }
}

export const FirmwareWatcher = new FirmwareWatcherClass();