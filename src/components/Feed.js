import React from 'react'
import {
  Alert,
  Keyboard,
  StyleSheet,
  TextInput,
  Modal,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl
} from 'react-native'

import Auth from '@aws-amplify/auth'
import Amplify from '@aws-amplify/core'

import { Card, Icon, Text } from 'native-base'

import { v4 as uuid } from 'uuid';

import config from '../aws-exports'
import CreatePost from '../graphQL/CreatePost'
import DeletePost from '../graphQL/DeletePost'
import listPosts from '../graphQL/listPosts'

// Apollo components
import { graphql, compose } from 'react-apollo'

Amplify.configure(config)

class Feed extends React.Component {
  state = {
    name: '',
    modalVisible: false,
    posts: [],
    postOwnerId: '',
    postOwnerUsername: '',
  }

  componentDidMount = async () => {
    const posts = await this.props.posts
    await this.setState({ posts: posts })
    await Auth.currentAuthenticatedUser()
      .then(user => {
        this.setState(
          {
            postOwnerUsername: user.username,
            postOwnerId: user.attributes.sub,
          }
        )
      })
      .catch(err => console.log(err))
  }

  _onRefresh = () => {
    this.setState({ refreshing: true })
    this.listPosts().then(() => {
      this.setState({ refreshing: false })
    })
  }

  showModal = () => {
    this.setState({ modalVisible: true })
  }

  hideModal = () => {
    this.setState({ modalVisible: false, name: '' })
  }

  onChangeText = (key, val) => {
    this.setState({ [key]: val })
  }

  createPost = async () => {
    if (this.state.name === '') {
      Alert.alert('Name it!')
      return
    }
    try {
      await this.props.onAdd({ id: uuid(), name: this.state.name })
      await this.componentDidMount()
      Keyboard.dismiss()
      this.hideModal()
    } catch (err) {
      console.log('Error creating post.', err)
    }
  }

  deletePostAlert = async (post) => {
    await Alert.alert(
      'Delete Post',
      'Are you sure you wanna delete this post?',
      [
        { text: 'Cancel', onPress: () => { return }, style: 'cancel' },
        { text: 'OK', onPress: () => this.deletePost(post) },
      ],
      { cancelable: false }
    )
  }

  deletePost = async (post) => {
    const postId = await post['id']
    try {
      await this.props.onRemove({ id: postId })
      await this.componentDidMount()
      console.log('Post successfully deleted.')
    } catch (err) {
      console.log('Error deleting post.', err)
    }
  }

  render() {
    let loggedInUser = this.state.postOwnerId
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.headerStyle}>
          <Modal
            animationType="slide"
            transparent={false}
            onRequestClose={() => { return }}
            visible={this.state.modalVisible}>
            <View style={styles.modalContainer}>
              <View style={styles.postCardStyle}>
                <Card>
                  <TextInput
                    onChangeText={val => this.onChangeText('name', val)}
                    placeholder="Tell us your best..."
                    value={this.state.name}
                    multiline={true}
                    maxLength={150}
                    autoFocus={true} // check for performance issue when true
                    style={{ height: 150, fontSize: 20, padding: 13 }}
                  />
                  <View style={{ alignItems: 'flex-end', padding: 5 }}>
                    <Text style={{ color: '#fb7777', fontWeight: 'bold' }}>
                      {150 - this.state.name.length}
                    </Text>
                  </View>
                </Card>
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    onPress={this.hideModal}
                    style={[styles.twinButtonStyle, { backgroundColor: '#5017AE' }]}>
                    <Text style={styles.buttonText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={this.createPost}
                    style={[styles.twinButtonStyle, { backgroundColor: '#f16f69' }]}>
                    <Text style={styles.buttonText}>
                      Submit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* Open modal to write a post */}
          <TouchableOpacity onPress={this.showModal}>
            <Icon
              active
              name='add-circle'
              style={styles.iconStyle}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={this.componentDidMount}>
            <Icon
              active
              name='refresh'
              style={styles.iconStyle}
            />
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this._onRefresh}
            />
          }
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            {
              this.state.posts.map((post, index) => (
                <Card key={index} style={styles.cardStyle}>
                  <View style={styles.cardHeaderStyle}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'flex-start' }}>
                      <TouchableOpacity
                        onPress={() => this.deletePostAlert(post)}>
                        <Icon name='md-more' style={{ color: '#1f267e', padding: 5 }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity>
                    <Text style={styles.postBody}>
                      {post.name}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.cardFooterStyle}>
                    <View style={{ flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                      <Text style={styles.postUsername}>
                        {post.postOwnerUsername}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            }
          </View>
        </ScrollView>
      </View>
    )
  }
}

export default compose(
  graphql(listPosts, {
    options: {
      fetchPolicy: 'network-only'
    },
    props: props => ({
      posts: props.data.listPosts ? props.data.listPosts.items : []
    })
  }),
  graphql(CreatePost, {
    options: {
      update: (dataProxy, { data: { createPost } }) => {
        const query = listPosts
        const data = dataProxy.readQuery({ query })
        data.listPosts.items.push(createPost)
        dataProxy.writeQuery({ query, data })
      }
    },
    props: (props) => ({
      onAdd: (post) => {
        props.mutate({
          variables: post,
          optimisticResponse: () => ({
            createPost: { ...post, __typename: 'Post' }
          }),
        })
      }
    }),
  }),
  graphql(DeletePost, {
    options: {
      update: (dataProxy, { data: { deletePost } }) => {
        const query = listPosts
        const data = dataProxy.readQuery({ query })
        const index = data.listPosts.items.findIndex(({ id }) => id === deletePost.id)
        if (index > -1) {
          data.listPosts.items.splice(index, 1)
        }
        dataProxy.writeQuery({ query, data })
      }
    },
    props: (props) => ({
      onRemove: (post) => {
        props.mutate({
          variables: post,
          optimisticResponse: () => ({
            deletePost: { ...post, __typename: 'Post' }
          }),
        })
      }
    }),
  })
)(Feed)

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStyle: {
    padding: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f267e'
  },
  postBody: {
    fontSize: 20,
    color: '#1f267e',
    padding: 12
  },
  iconStyle: {
    color: '#5017ae',
    fontSize: 38
  },
  cardStyle: {
    flex: 1,
    backgroundColor: '#d0d9ed',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooterStyle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderStyle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  buttonContainer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  twinButtonStyle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderRadius: 3,
    width: 130,
    height: 48,
    flexDirection: 'row'
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: "#fff",
  },
  postCardStyle: {
    marginTop: 45,
    padding: 20
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#eadee4'
  }
})