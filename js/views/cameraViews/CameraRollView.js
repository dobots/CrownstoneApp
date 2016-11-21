import React, { Component } from 'react' 
import {
  Alert,
  CameraRoll,
  Image,
  Dimensions,
  ScrollView,
  TouchableHighlight,
  Text,
  View
} from 'react-native';

var Actions = require('react-native-router-flux').Actions;
import { TopBar } from '../components/Topbar';
import { styles, colors } from '../styles'
import { LOG, LOGError } from '../../logging/Log'

export class CameraRollView extends Component {
  constructor() {
    super();

    this.pictureIndex = undefined;
    this.state = {pictures:[]};
    this.active = true;
    this.fetchPicturesTimeout = setTimeout(() => {this.fetchPictures();},350);
  }

  componentWillUnmount() {
    clearTimeout(this.fetchPicturesTimeout);
  }

  fetchPictures() {
    if (this.active === true) {
      let query = {
        first: 10,
        groupTypes: 'SavedPhotos',
        assetType: 'Photos',
      };
      if (this.pictureIndex !== undefined) {
        query.after = this.pictureIndex;
      }
      
      CameraRoll.getPhotos(query).then((data) => {
        this.pictureIndex = data.page_info.end_cursor;
        if (data.page_info.has_next_page === true) {
          this.fetchPictures();
        }

        let pictures = [...this.state.pictures, ...data.edges];
        this.setState({pictures: pictures})
      }).catch((err) => {
        if (err.code === "E_UNABLE_TO_LOAD") {
          Alert.alert(
            "I do not have access to your pictures...",
            "You can give me access by going to the settings on your phone, select Crownstone and enable the picture permissions.",
            [{text:"OK", onPress:() => {Actions.pop();}}]);
        }
        else {
          LOGError(err.message, err)
        }
      });
    }
  }

  drawPictures() {
    if (this.state.pictures.length > 0) {
      let width = Dimensions.get('window').width;

      let amountX = 4;
      let size = width / amountX;

      let images = [];
      let rows = [];
      this.state.pictures.forEach((edge, index) => {
        images.push((
          <TouchableHighlight key={'image'+index} onPress={() => {
            this.props.selectCallback(edge.node.image.uri);
            Actions.pop();
            }}>
            <Image source={{uri:edge.node.image.uri}} style={{width:size,height:size}}/>
          </TouchableHighlight>
        ));
        if (images.length == amountX) {
          rows.push(<View key={'imageRow' + rows.length} style={{flexDirection:'row'}}>{images}</View>);
          images = [];
        }
      });

      if (images.length > 0) {
        rows.push(<View key={'imageRow' + rows.length} style={{flexDirection:'row'}}>{images}</View>);
        images = [];
      }

      return <ScrollView key="theScroll" style={{flexDirection:'column'}}>{rows}</ScrollView>;
    }
  }

  render() {
    return (
      <View style={[styles.fullscreen, {backgroundColor:'#fff'}]}>
        <TopBar title="Choose A Picture" left="Cancel" leftAction={() => {this.active = false; Actions.pop();}} notBack={true} />
        {this.drawPictures()}
      </View>
    );
  }
}
