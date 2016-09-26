import React, {Component} from 'react'
import {
  Animated,
  Dimensions,
  Image,
  NativeModules,
  ScrollView,
  TouchableHighlight,
  Text,
  View
} from 'react-native';

var Actions = require('react-native-router-flux').Actions;

import {ProfilePicture} from './ProfilePicture'
import {RoomCircle} from './RoomCircle'
import {getOrphanedStones, getAmountOfStonesInLocation} from '../../util/dataUtil'

import {styles, colors, screenWidth, screenHeight} from '../styles'
import {LOG} from '../../logging/Log'


export class RoomLayer extends Component {
  constructor() {
    super();
    this.state = {presentUsers: {}, a: 1};

    this.roomRadius = 0.35 * 0.5 * screenWidth;
    this.availableSpace = (screenHeight - 175) - this.roomRadius; // for top bar and menu bar

    this.roomPositions = {
      1: [
        {x: 0.5 * screenWidth - this.roomRadius, y: 0.5 * this.availableSpace},
      ],
      2: [
        {x: 0.15 * screenWidth, y: 0.20 * this.availableSpace},
        {x: 0.50 * screenWidth, y: 0.75 * this.availableSpace}
      ],
      3: [
        {x: 0.12 * screenWidth, y: 0.12 * this.availableSpace},
        {x: 0.55 * screenWidth, y: 0.48 * this.availableSpace},
        {x: 0.08 * screenWidth, y: 0.88 * this.availableSpace},
      ],
      4: [
        {x: 0.10 * screenWidth, y: 0.12 * this.availableSpace},
        {x: 0.55 * screenWidth, y: 0.25 * this.availableSpace},
        {x: 0.08 * screenWidth, y: 0.90 * this.availableSpace},
        {x: 0.60 * screenWidth, y: 0.75 * this.availableSpace}
      ],
      5: [
        {x: 0.12 * screenWidth, y: 0.08 * this.availableSpace},
        {x: 0.06 * screenWidth, y: 0.50 * this.availableSpace},
        {x: 0.55 * screenWidth, y: 0.25 * this.availableSpace},
        {x: 0.14 * screenWidth, y: 0.94 * this.availableSpace},
        {x: 0.60 * screenWidth, y: 0.75 * this.availableSpace}
      ],
      6: [
        {x: 0.08 * screenWidth, y: 0.06 * this.availableSpace},
        {x: 0.08 * screenWidth, y: 0.16 * this.availableSpace + 2.0 * this.roomRadius},
        {x: 0.08 * screenWidth, y: 0.26 * this.availableSpace + 4.0 * this.roomRadius},
        {x: 0.57 * screenWidth, y: 0.14 * this.availableSpace},
        {x: 0.57 * screenWidth, y: 0.24 * this.availableSpace + 2.0 * this.roomRadius},
        {x: 0.57 * screenWidth, y: 0.34 * this.availableSpace + 4.0 * this.roomRadius}
      ],
    };

    this.presentUsers = {}

  }

  componentDidMount() {
    const {store} = this.props;
    this.unsubscribe = store.subscribe(() => {
      if (this.renderState === undefined)
        return;

      // only redraw if the amount of rooms changes.
      if (this.props.sphereId) {
        const state = store.getState();

        let orphanedStonesNow = getOrphanedStones(state, this.props.sphereId);
        let orphanedStonesBefore = getOrphanedStones(this.renderState, this.props.sphereId);

        let amountOfRooms = Object.keys(state.spheres[this.props.sphereId].locations).length + orphanedStonesNow;
        let amountOfRoomsBefore = Object.keys(this.renderState.spheres[this.props.sphereId].locations).length + orphanedStonesBefore;
        if (amountOfRooms !== amountOfRoomsBefore) {
          this.forceUpdate();
        }
      }
    });
  }

  componentWillUpdate(newProps) {
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  // experiment
  shouldComponentUpdate(nextProps, nextState) {
    LOG("Should component update?", nextProps, nextState);
    return false
  }

  _renderRoom(locationId, room, sphereId, count, index, amountOfStones) {
    // get the position for the room
    let pos = {};
    if (count > 6) {
      if (index % 2 == 0) {
        pos = {
          x: 0.08 * screenWidth,
          y: 0.06 * this.availableSpace + Math.floor(index / 2) * 0.1 * this.availableSpace + Math.floor(index / 2) * 2 * this.roomRadius
        }
      }
      else {
        pos = {
          x: 0.57 * screenWidth,
          y: 0.14 * this.availableSpace + Math.floor(index / 2) * 0.1 * this.availableSpace + Math.floor(index / 2) * 2 * this.roomRadius
        }
      }
    }
    else {
      pos = this.roomPositions[count][index];
    }
    this.maxY = Math.max(this.maxY, pos.y);

    // variables to pass to the room overview
    let actionsParams = {
      sphereId: sphereId,
      locationId: locationId,
      title: room.config.name,
      remote: this.props.remote
    };


    if (locationId === null) {
      actionsParams.renderRightButton = function () {
        return false
      }
    }

    return (
      <TouchableHighlight onPress={() => Actions.roomOverview(actionsParams)} key={locationId + "_" + Math.random()}>
        <View>
          <RoomCircle
            locationId={locationId}
            sphereId={this.props.sphereId}
            radius={this.roomRadius}
            store={this.props.store}
            pos={pos}
            remote={this.props.remote}
          />
        </View>
      </TouchableHighlight>
    );
  }

  getRooms() {
    this.maxY = 0;
    const store = this.props.store;
    const state = store.getState();
    let rooms = state.spheres[this.props.sphereId].locations;


    let orphanedStones = getOrphanedStones(state, this.props.sphereId);

    let roomNodes = [];
    let roomIdArray = Object.keys(rooms).sort();
    LOG(roomIdArray)

    let amountOfRooms = roomIdArray.length;

    // the orphaned stones room.
    if (orphanedStones.length > 0) {
      amountOfRooms += 1;
    }

    for (let i = 0; i < roomIdArray.length; i++) {
      let amountOfStones = getAmountOfStonesInLocation(state, this.props.sphereId, roomIdArray[i]);
      roomNodes.push(this._renderRoom(roomIdArray[i], rooms[roomIdArray[i]], this.props.sphereId, amountOfRooms, i, amountOfStones))
    }

    if (orphanedStones.length > 0) {
      roomNodes.push(this._renderRoom(null, {config: {name: "Floating Crownstones"}}, this.props.sphereId, amountOfRooms, amountOfRooms - 1))
    }

    if (roomIdArray.length > 6) {
      return (
        <ScrollView style={{height: screenHeight, screenWidth: screenWidth}}>
          <View style={{height: this.maxY + 2 * this.roomRadius + 200}}>
            {roomNodes}
          </View>
        </ScrollView>
      )
    }
    else {
      return roomNodes;
    }
  }

  render() {
    const store = this.props.store;
    const state = store.getState();
    this.renderState = state;

    LOG("rendering room layer");

    return (
      <View style={{width: screenWidth, flex:1}}>
        {this.getRooms()}
      </View>
    )

  }
}