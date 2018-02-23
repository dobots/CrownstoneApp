import { eventBus }              from '../util/EventBus'
import { Util }                  from '../util/Util'
import { BlePromiseManager }     from './BlePromiseManager'
import { BluenetPromiseWrapper } from '../native/libInterface/BluenetPromise';
import {LOG, LOGd, LOGi} from '../logging/Log'
import { Scheduler }             from './Scheduler'
import { MeshHelper }            from './MeshHelper'
import { DISABLE_NATIVE, STONE_TIME_REFRESH_INTERVAL } from '../ExternalConfig'
import { StoneUtil }             from "../util/StoneUtil";
import { Permissions }           from "../backgroundProcesses/PermissionManager";
import { CommandManager }        from "./bchComponents/CommandManager";
import {RssiLogger} from "../native/advertisements/RssiLogger";


/**
 * This can be used to batch commands over the mesh or 1:1 to the Crownstones.
 */
class BatchCommandHandlerClass {
  store: any;
  sphereId  : any;
  activePromiseId : string = null;

  _unsubscribeCloseListener : any = null;
  _removeCloseConnectionTimeout  : any = null;
  _unsubscribeLoadListener  : any = null;

  _commandHandler : CommandManager;

  constructor() {
    this._commandHandler = new CommandManager();
  }

  loadStore(store) {
    this.store = store;
  }

  closeKeptOpenConnection() {
    eventBus.emit("BatchCommandHandlerCloseConnection");
  }

  /**
   * @param { Object } stone              // Redux Stone Object
   * @param { String } stoneId            // StoneId,
   * @param { String } sphereId           // sphereId,
   * @param { commandInterface } command  // Object containing a command that is in the BluenetPromise set
   * @param { batchCommandEntryOptions } options  // options
   * @param { number } attempts           // amount of times to try this command before failing
   * @param { string } label              // explain where the command comes from,
   */
  load(stone, stoneId, sphereId, command : commandInterface, options: batchCommandEntryOptions = {}, attempts: number = 1, label = '') {
    LOG.verbose("BatchCommandHandler: Loading Command, sphereId:",sphereId," stoneId:", stoneId, stone.config.name, command, label);
    return this._commandHandler.load(stone, stoneId, sphereId, command, false,  attempts, options );
  }

  /**
   * @param { Object } stone              // Redux Stone Object
   * @param { String } stoneId            // StoneId,
   * @param { String } sphereId           // sphereId,
   * @param { commandInterface } command  // Object containing a command that is in the BluenetPromise set
   * @param { batchCommandEntryOptions } options  // options
   * @param { number } attempts           // amount of times to try this command before failing
   * @param { string } label              // explain where the command comes from,
   */
  loadPriority(stone, stoneId, sphereId, command : commandInterface, options: batchCommandEntryOptions = {}, attempts: number = 1, label = '') {
    LOG.verbose("BatchCommandHandler: Loading High Priority Command, sphereId:",sphereId," stoneId", stoneId, stone.config.name, command, label);
    return this._commandHandler.load(stone, stoneId, sphereId, command, true, attempts, options );
  }


  /**
   * Convert all the todos to an array of event topics we can listen to.
   * These events are triggered by advertisements or ibeacon messages.
   * @returns {Array}
   * @private
   */
  _getObjectsToScan() {
    // this will mark all candidates during this scan as initialized. These are ALL marked as initialized since if we do not find ANY crownstones,
    // we will have to reduce the attempts of all of them.
    let { directCommands, meshNetworks } = this._commandHandler.extractTodo(this.store.getState(),null, null, true);

    // get sphereIds of the spheres we need to do things in.
    let meshSphereIds = Object.keys(meshNetworks);
    let directSphereIds = Object.keys(directCommands);
    let topicsToScan = [];

    // find all topics in the mesh sphereId
    meshSphereIds.forEach((sphereId) => {
      let meshNetworkIds = Object.keys(meshNetworks[sphereId]);
      meshNetworkIds.forEach((networkId) => {
        LOG.info("BatchCommandHandler: meshNetworkCommands for sphere", sphereId, ", command:", meshNetworks[sphereId][networkId], this.activePromiseId);
        topicsToScan.push({ sphereId: sphereId, topic: Util.events.getMeshTopic(sphereId, networkId) });
      });
    });

    // find all the topics for individual crownstones.
    directSphereIds.forEach((sphereId) => {
      directCommands[sphereId].forEach((command) => {
        LOG.info("BatchCommandHandler: directCommands for sphere:", sphereId, " stone:", command.stoneId, ", command:", command.command, this.activePromiseId);
        topicsToScan.push({ sphereId: sphereId, topic: Util.events.getCrownstoneTopic(sphereId, command.stoneId) });
      });
    });
    return topicsToScan;
  }


  /**
   * This will commands one by one to the connected Crownstone.
   * @param connectionInfo
   * @param activeOptions
   * @returns { Promise<T> }
   */
  _handleAllCommandsForStone(connectionInfo: connectionInfo, activeOptions : any = {}) {
    return new Promise((resolve, reject) => {
      // get everything we CAN and WILL do now with this Crownstone.
      let { directCommands, meshNetworks } = this._commandHandler.extractTodo(this.store.getState(), connectionInfo.stoneId, connectionInfo.meshNetworkId);

      // check if we have to perform any mesh commands for this Crownstone.
      let meshSphereIds = Object.keys(meshNetworks);
      let promise = null;
      for (let i = 0; i < meshSphereIds.length; i++) {
        let networksInSphere = meshNetworks[meshSphereIds[i]];
        let meshNetworkIds = Object.keys(networksInSphere);
        // pick the first network to handle
        if (meshNetworkIds.length > 0) {
          let helper = new MeshHelper(meshSphereIds[i], meshNetworkIds[i], networksInSphere[meshNetworkIds[0]]);
          promise = helper.performAction();

          // merge the active options with those of the mesh instructions.
          MeshHelper._mergeOptions(helper.activeOptions, activeOptions);
          break;
        }
      }

      // if we did not have a mesh command to handle, try the direct commands.
      if (promise === null) {
        let directSphereIds = Object.keys(directCommands);
        let actionPromise = null;
        let performedAction = null;
        for (let i = 0; i < directSphereIds.length; i++) {
          let commandsInSphere = directCommands[directSphereIds[i]];
          if (commandsInSphere.length > 0) {
            let action = directCommands[directSphereIds[i]][0];
            let command = action.command;
            performedAction = action;
            // merge the active options with those of the mesh instructions.
            MeshHelper._mergeOptions(action.options, activeOptions);
            switch (command.commandName) {
              case 'getFirmwareVersion':
                actionPromise = BluenetPromiseWrapper.getFirmwareVersion();
                break;
              case 'getHardwareVersion':
                actionPromise = BluenetPromiseWrapper.getHardwareVersion();
                break;
              case 'getErrors':
                actionPromise = BluenetPromiseWrapper.getErrors();
                break;
              case 'clearErrors':
                actionPromise = BluenetPromiseWrapper.clearErrors(command.clearErrorJSON);
                // actionPromise = BluenetPromiseWrapper.restartCrownstone();
                break;
              case 'setTime':
                let timeToSet = command.time === undefined ? StoneUtil.nowToCrownstoneTime() : command.time;
                actionPromise = BluenetPromiseWrapper.setTime(timeToSet);
                break;
              case 'getTime':
                actionPromise = BluenetPromiseWrapper.getTime();
                break;
              case 'keepAlive':
                actionPromise = BluenetPromiseWrapper.keepAlive();
                break;
              case 'keepAliveState':
                actionPromise = BluenetPromiseWrapper.keepAliveState(command.changeState, command.state, command.timeout);
                break;
              case 'getSchedules':
                actionPromise = BluenetPromiseWrapper.getSchedules();
                break;
              case 'clearSchedule':
                actionPromise = BluenetPromiseWrapper.clearSchedule(command.scheduleEntryIndex);
                break;
              case 'getAvailableScheduleEntryIndex':
                actionPromise = BluenetPromiseWrapper.getAvailableScheduleEntryIndex();
                break;
              case 'setSchedule':
                actionPromise = BluenetPromiseWrapper.setSchedule(command.scheduleConfig);
                break;
              case 'addSchedule':
                actionPromise = BluenetPromiseWrapper.addSchedule(command.scheduleConfig);
                break;
              case 'allowDimming':
                actionPromise = BluenetPromiseWrapper.allowDimming(command.value);
                break;
              case 'lockSwitch':
                actionPromise = BluenetPromiseWrapper.lockSwitch(command.value);
                break;
              case 'setSwitchState':
              case 'multiSwitch': // if it's a direct call, we just use the setSwitchState.
                actionPromise = BluenetPromiseWrapper.setSwitchState(command.state);
                break;
              default:
                performedAction = null;
            }
            break;
          }
        }

        // if the direct command is performed, clean up the command afterwards.
        if (actionPromise !== null) {
          // clean up by resolving the promises of the items contained in the mesh messages.
          promise = actionPromise.then((data) => {
            performedAction.promise.resolve(data);
            performedAction.cleanup();
          })
        }
      }


      // if there is something to do, perform the promise and schedule the next one so we will
      // handle all commands for this Crownstone.
      if (promise !== null) {
        promise
          .then(() => {
            // we assume the cleanup of the action(s) has been called.
            return this._handleAllCommandsForStone(connectionInfo, activeOptions);
          })
          .then(() => {
            resolve(activeOptions);
          })
          .catch((err) => {
            reject(err);
          })
      }
      else {
        resolve(activeOptions);
      }
    })
  }


  /**
   * This searches for very recent readings of Crownstones that are near before we start to search for them.
   * @param rssiScanThreshold
   * @returns {any}
   * @private
   */
  _getConnectionTarget(rssiScanThreshold) : Promise<connectionInfo> {
    return new Promise((resolve, reject) => {
      let state = this.store.getState();

      let { directTargets, relayOnlyTargets, sphereMap } = this._commandHandler.extractConnectionTargets(state)

      let nearestRelay = null;
      let nearestDirect = RssiLogger.getNearestStoneId(directTargets, 2, rssiScanThreshold);
      if (!nearestDirect && rssiScanThreshold !== null) { nearestDirect = RssiLogger.getNearestStoneId(directTargets,    2);                    }
      if (!nearestDirect)                               { nearestRelay  = RssiLogger.getNearestStoneId(relayOnlyTargets, 2, rssiScanThreshold); }
      if (!nearestRelay && rssiScanThreshold !== null)  { nearestRelay  = RssiLogger.getNearestStoneId(relayOnlyTargets, 2);                    }

      let foundId = nearestDirect || nearestRelay;

      if (nearestDirect) {
        LOGi.info("BatchCommandHandler: Found stone to directly connect to:", nearestDirect);
      }
      else if (nearestRelay) {
        LOGi.info("BatchCommandHandler: Found stone to connect to in order for it to relay a command for us:", nearestDirect);
      }
      else {
        LOGi.info("BatchCommandHandler: No relevant stones found in the scan history for the last few seconds");
      }

      if (foundId) {
        let sphereId = sphereMap[foundId];
        let sphere = state.spheres[sphereId];
        let stone = sphere.stones[foundId];

        resolve({
          sphereId :      sphereId,
          stoneId:        foundId,
          stone:          stone,
          meshNetworkId:  stone.config.meshNetworkId,
          handle :        stone.config.handle,
        });
      }

      reject();
    });
  }



  /**
   * This method will search for Crownstones using the topics provided by the _getObjectsToScan.
   * It will connect to the first responder and perform all commands for that Crownstone. It will then move on to the next one.
   * @returns {Promise<T>}
   */
  _searchAndHandleCommands() {
    return new Promise((resolve, reject) => {
      let topicsToScan = this._getObjectsToScan();
      if (topicsToScan.length === 0) {
        // Use the attempt handler to clean up after something fails.
        this.attemptHandler(null, 'Nothing to scan');

        LOG.info("BatchCommandHandler: No topics to scan during BatchCommandHandler execution", this.activePromiseId);
        resolve();

        // abort the rest of the method.
        return;
      }

      // if there is a high priority call that we need to do, ignore the rssi limit.
      let highPriorityActive = this._commandHandler.highPriorityCommandAvailable();
      let rssiScanThreshold = -91;
      if (highPriorityActive) {
        rssiScanThreshold = null;
      }

      let activeCrownstone = null;



      // get a connection target
      this._getConnectionTarget(rssiScanThreshold)
        .catch(() => {
          // cant find a crownstone in the recent scans, look for one.
          return this._searchScan(topicsToScan, rssiScanThreshold, highPriorityActive, 5000)
            .catch((err) => {
              // nothing found within -91. if this is a low priority call, we will attempt it without the rssi threshold.
              if (rssiScanThreshold !== null && highPriorityActive === false) {
                return this._searchScan(topicsToScan, null, false, 5000)
              }
              else {
                throw err;
              }
            })
        })
        .then((crownstoneToHandle : connectionInfo) => {
          activeCrownstone = crownstoneToHandle;
          if (crownstoneToHandle === null) {
            // this happens during a priority interrupt
            return;
          }
          else {
            return this._connectAndHandleCommands(crownstoneToHandle);
          }
        })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          // Use the attempt handler to clean up after something fails.
          this.attemptHandler(activeCrownstone, err);

          // attempt to reschedule on failure.
          if (this._commandHandler.commandsAvailable()) {
            this._scheduleNextStone();
          }

          reject(err);
        })
        .catch((err) => {
          // this fallback catches errors in the attemptHandler.
          LOG.error("BatchCommandHandler: FATAL ERROR DURING EXECUTE", err, this.activePromiseId);
          reject(err);
        })
    })
  }

  _connectAndHandleCommands(crownstoneToHandle : connectionInfo) {
    return new Promise((resolve, reject) => {
      LOG.info("BatchCommandHandler: connecting to ", crownstoneToHandle, this.activePromiseId);
      BluenetPromiseWrapper.connect(crownstoneToHandle.handle)
        .then(() => {
          LOG.info("BatchCommandHandler: Connected to ", crownstoneToHandle, this.activePromiseId);
          return this._handleAllCommandsForStone(crownstoneToHandle);
        })
        .then((optionsOfPerformedActions : batchCommandEntryOptions) => {
          if (optionsOfPerformedActions.keepConnectionOpen === true) {
            return this._keepConnectionOpen(optionsOfPerformedActions, crownstoneToHandle, true);
          }
        })
        .then(() => {
          if (Permissions.inSphere(crownstoneToHandle.sphereId).setStoneTime && this.store) {
            // check if we have to tell this crownstone what time it is.
            let state = this.store.getState();
            let lastTime = state.spheres[crownstoneToHandle.sphereId].stones[crownstoneToHandle.stoneId].config.lastUpdatedStoneTime;
            // if it is more than 5 hours ago, tell this crownstone the time.
            if (new Date().valueOf() - lastTime > STONE_TIME_REFRESH_INTERVAL) {
              // this will never halt the chain since it's optional.
              return BluenetPromiseWrapper.setTime(StoneUtil.nowToCrownstoneTime())
                .then(() => {
                  this.store.dispatch({type: "UPDATED_STONE_TIME", sphereId: crownstoneToHandle.sphereId, stoneId: crownstoneToHandle.stoneId})
                })
                .catch((err) => {
                  LOG.warn("BatchCommandHandler: Could not set the time of Crownstone", err);
                });
            }
            else {
              LOGd.info("BatchCommandHandler: Decided not to set the time because delta time:", new Date().valueOf() - lastTime, ' ms.');
            }
          }
          else {
            LOGd.info("BatchCommandHandler: Decided not to set the time Permissions.setStoneTime:", Permissions.inSphere(crownstoneToHandle.sphereId).setStoneTime, Permissions.inSphere(crownstoneToHandle.sphereId).setStoneTime && this.store);
          }
        })
        .then(() => {
          return BluenetPromiseWrapper.disconnectCommand();
        })
        .then(() => {
          if (this._commandHandler.commandsAvailable()) {
            this._scheduleNextStone();
          }
        })
        .then(() => {
          resolve();
        })
        .catch((err) => {
          BluenetPromiseWrapper.phoneDisconnect()
            .then(() => {
              reject(err);
            })
        })
    });
  }

  _keepConnectionOpen(options, crownstoneToHandle : connectionInfo, original: boolean) {
    return new Promise((resolve, reject) => {
      let scheduleCloseTimeout = (timeout) => {
        this._removeCloseConnectionTimeout = Scheduler.scheduleCallback(() => {
          this._cleanKeepOpen();
          resolve();
        }, timeout, 'Close connection in BHC due to timeout.');
      };

      if (original) {
        let timeout = options.keepConnectionOpenTimeout || 5000;
        scheduleCloseTimeout(timeout);
      }

      this._unsubscribeCloseListener = eventBus.on("BatchCommandHandlerCloseConnection", () => {
        this._cleanKeepOpen();
        resolve();
      });

      this._unsubscribeLoadListener = eventBus.on("BatchCommandHandlerLoadAction", () => {
        // remove all listeners before moving on.
        this._cleanKeepOpen();

        this._handleAllCommandsForStone(crownstoneToHandle)
          .then((optionsOfPerformedActions : batchCommandEntryOptions) => {
            if (optionsOfPerformedActions.keepConnectionOpenTimeout && optionsOfPerformedActions.keepConnectionOpenTimeout > 0) {
              this._removeCloseConnectionTimeout();
              scheduleCloseTimeout( optionsOfPerformedActions.keepConnectionOpenTimeout )
            }
            return this._keepConnectionOpen(options, crownstoneToHandle, false);
          })
          .then(() => {
            this._cleanKeepOpen();
            resolve();
          })
          .catch((err) => { reject(err); })
      });
    });
  }

  _cleanKeepOpen(includeTimeout: boolean = true) {
    if (typeof this._unsubscribeCloseListener === 'function') {
      this._unsubscribeCloseListener();
      this._unsubscribeCloseListener = null;
    }
    if (typeof this._unsubscribeLoadListener === 'function') {
      this._unsubscribeLoadListener();
      this._unsubscribeLoadListener = null;
    }

    if (includeTimeout) {
      if (typeof this._removeCloseConnectionTimeout === 'function') {
        this._removeCloseConnectionTimeout();
        this._removeCloseConnectionTimeout = null;
      }
    }
  }

  /**
   * This is invoked after something during the process fails.
   * It reduces the attempt counter in the affected processes by 1. If the attempt count is at 0, it will remove the command
   * from the list.
   * @param connectedCrownstone
   * @param err
   */
  attemptHandler(connectedCrownstone, err) {
    let handleAttempt = (command) => {
      // The command has to be initialized first.
      // This is required to avoid the cases where commands that are loaded while there is a pending process
      // If that pending process fails, anything that was loaded during that time would be cancelled as well.
      if (command.initialized === true) {
        command.attempts -= 1;
        if (command.attempts <= 0) {
          command.promise.reject(err);
          command.cleanup();
        }
      }
    };

    // if we did not find anything to connect to, we will reduce all open attempts.
    if (!connectedCrownstone) {
      connectedCrownstone = {stoneId: null, meshNetworkId: null};
    }

    // get all todos that would have been done to reduce their attempt counts.
    let { directCommands, meshNetworks } = this._commandHandler.extractTodo(this.store.getState(), connectedCrownstone.stoneId, connectedCrownstone.meshNetworkId);
    let directCommandSpheres = Object.keys(directCommands);
    directCommandSpheres.forEach((sphereId) => {
      let commandsInSphere = directCommands[sphereId];
      commandsInSphere.forEach(handleAttempt);
    });

    let meshNetworkSpheres = Object.keys(meshNetworks);
    meshNetworkSpheres.forEach((sphereId) => {
      let networkTodo = meshNetworks[sphereId][connectedCrownstone.meshNetworkId];

      // only handle the attempts if there are any for this sphere.
      if (!networkTodo) {
        return;
      }

      networkTodo.keepAlive.forEach(handleAttempt);
      networkTodo.keepAliveState.forEach(handleAttempt);
      networkTodo.multiSwitch.forEach(handleAttempt);
    });
  }


  execute() {
    this._execute(false);
  }

  executePriority() {
    eventBus.emit('PriorityCommandSubmitted');
    this._execute(true);
  }

  _scheduleNextStone() {
    this._scheduleExecute(false);
  }

  /**
   * @param { Boolean } priority        //  this will move any command to the top of the queue
   */
  _execute(priority) {
    this._scheduleExecute(priority);
  }

  _scheduleExecute(priority) {
    // HACK TO SUCCESSFULLY DO ALL THINGS WITH BHC WITHOUT NATIVE
    if (DISABLE_NATIVE === true) {
      Scheduler.scheduleCallback(() => {
        this._commandHandler.forceCleanAllCommands()
      }, 1500, "Fake native handling of BHC");
      return;
    }

    LOG.info("BatchCommandHandler: Scheduling command in promiseManager");
    let actionPromise = () => {
      this.activePromiseId = Util.getUUID();
      LOG.info("BatchCommandHandler: Executing!", this.activePromiseId);
      return this._searchAndHandleCommands();
    };

    let promiseRegistration = null;

    if (priority) { promiseRegistration = BlePromiseManager.registerPriority.bind(BlePromiseManager); }
    else          { promiseRegistration = BlePromiseManager.register.bind(BlePromiseManager); }

    promiseRegistration(actionPromise, {from: 'BatchCommandHandler: executing.'})
      .catch((err) => {
        // disable execution stop the error propagation since this is not returned anywhere.
        LOG.error("BatchCommandHandler: Error completing promise.", err, this.activePromiseId);
      });
  }



  /**
   * return Promise which will resolve to a handle to connect to.
   * If this returns null, the search has been cancelled prematurely.
   * @private
   */
  _searchScan(objectsToScan : any[], rssiThreshold = null, highPriorityActive = false, timeout = 5000) {
    return new Promise((resolve, reject) => {

      let unsubscribeListeners = [];

      let cleanup = () => {
        // remove all listeners
        unsubscribeListeners.forEach((unsubscribe) => {
          unsubscribe();
        });

        unsubscribeListeners = [];
      };

      // scheduled timeout in case we do not hear anything from the event
      let clearCleanupCallback = Scheduler.scheduleCallback(() => {
        // remove the listeners
        cleanup();

        LOG.warn("BatchCommandHandler: No stones found before timeout.");
        reject("No stones found before timeout.");
      }, timeout, 'Looking for target...');


      // if we're busy with a low priority command, we will stop the search if a high priority execute comes in.
      if (highPriorityActive !== true) {
        unsubscribeListeners.push(eventBus.on('PriorityCommandSubmitted', () => {
          LOG.info("BatchCommandHandler: Stopped listening for Crownstones due to Priority Execute.");
          // remove the listeners
          cleanup();

          // remove cleanup callback
          clearCleanupCallback();

          // resolve with the handle.
          resolve(null);
        }));
      }

      // cleanup timeout
      objectsToScan.forEach((topic) => {
        // data: { handle: stone.config.handle, id: stoneId, rssi: rssi }
        unsubscribeListeners.push( eventBus.on(topic.topic, (data) => {
          LOGd.info("BatchCommandHandler: Got an event:", data);
          if (rssiThreshold === null || data.rssi > rssiThreshold) {
            // remove the listeners
            cleanup();

            // remove cleanup callback
            clearCleanupCallback();

            // resolve with the handle.
            resolve({
              stoneId: data.stoneId,
              meshNetworkId: data.meshNetworkId || null,
              sphereId: topic.sphereId,
              handle: data.handle
            });
          }
        }));
      });
    })
  }
}

export const BatchCommandHandler = new BatchCommandHandlerClass();