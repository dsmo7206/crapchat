import React from "react";
import AlertContainer from "react-alert";

import { AppHeader } from "./AppHeader";
import { Chat } from "./Chat";
import { ChatSummary } from "./ChatSummary";
import { ChatFinder } from "./ChatFinder";
import { NullChat } from "./NullChat";

class App extends React.Component {
    constructor() {
        super();

        this.state = {
            connected: false,
            messageMap: new Map(), 
            chatNameMap: new Map(),
            selectedChatid: null,
            findChatSuggestions: []
        };

        this.alertOptions = {
            offset: 14,
            position: 'bottom left',
            theme: 'dark',
            time: 5000,
            transition: 'scale'
        }

        this.showError = this.showError.bind(this);
        this.onSocketMessage = this.onSocketMessage.bind(this);
        this.joinChat = this.joinChat.bind(this);
        this.leaveChat = this.leaveChat.bind(this);
        this.requestNewMessage = this.requestNewMessage.bind(this);
        this.onSummaryClicked = this.onSummaryClicked.bind(this);
        this.findChatOnKeyDown = this.findChatOnKeyDown.bind(this);
        this.requestChatSuggestions = this.requestChatSuggestions.bind(this);
    }

    componentDidMount() {
        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? 'wss://' : 'ws://') + 
            window.location.host + "/client/" + 0 // this is the userid - change to auth
        );
        this.socket.onmessage = this.onSocketMessage;

        this.socket.onopen = () => { 
            this.setState({connected: true});
        };

        this.socket.onclose = () => {
            this.setState({connected: false});
        }
    }

    showError(text) {
        this.msg.error(text, {
            time: 2000,
            //type: 'success',
            //icon: <img src="path/to/some/img/32x32.png"/>
        })
    }

    onSocketMessage(event) {
        const data = JSON.parse(event.data);

        if (data.type === 'chat_suggestions')
        {
            this.setState({findChatSuggestions: data.data});
        }
        else if (data.type === 'refresh')
        {
            let messageMap = new Map(this.state.messageMap);
            let chatNameMap = new Map(this.state.chatNameMap);

            for (let i = 0; i < data.chat_data.length; ++i)
            {
                messageMap.set(data.chat_data[i].chatid, data.chat_data[i].messages);
                chatNameMap.set(data.chat_data[i].chatid, data.chat_data[i].name);
            }

            this.setState({messageMap: messageMap});
            this.setState({chatNameMap: chatNameMap});
        }
        else if (data.type === 'new_message')
        {
            let messageMap = new Map(this.state.messageMap);
            messageMap.set(data.chatid, messageMap.get(data.chatid).concat(data.data));
            this.setState({messageMap: messageMap});
        }
        else
        {
            console.error('Got invalid data.type: ' + data.type);
        }
    }

    joinChat(chatid) {
        // Call this when we are opening a new chat
        if (this.state.messageMap.has(chatid))
        {
            this.showError('You are already in this chat!');
            return;
        }
        this.socket.send(JSON.stringify({'type': 'join_chat', 'chatid': chatid}))
    }

    leaveChat(chatid) {
        if (this.state.selectedChatid == chatid)
        {
            this.setState({selectedChatid: null});
        }

        this.socket.send(JSON.stringify({'type': 'leave_chat', 'chatid': chatid}))

        // Is the call above async? If so, it's possible that after calling,
        // we will immediately remove the key below, and before the server
        // has responded to the "leave" message, it will send further updates
        // for the chat we are in the middle of leaving, causing some kind of error.
        //
        // If possible, we want to await the call above.

        let messageMap = new Map(this.state.messageMap);
        messageMap.delete(chatid);
        this.setState({messageMap: messageMap});
    }

    onSummaryClicked(chatid) {
        console.log('onSummaryClicked: ' + chatid);
        this.setState({selectedChatid: chatid});
    }

    findChatOnKeyDown(event) {
        console.log('find chat got event: ' + event);
    }

    requestNewMessage(chatid, message) {
        this.socket.send(JSON.stringify({
            'type': 'new_message', 
            'chatid': chatid, 
            'message': message
        }));
    }

    requestChatSuggestions(searchString) {
        this.socket.send(JSON.stringify({
            'type': 'get_chat_suggestions',
            'searchString': searchString
        }));
    }

    render() {
        if (!this.state.connected)
        {
            return <div>Not connected</div>;
        }

        const messagesArray = Array.from(this.state.messageMap.entries());

        const findChatInput = (
            <li key="findChat">
                <ChatFinder 
                    requestChatSuggestions={this.requestChatSuggestions}
                    onSuggestionsClearRequested={() => {this.setState({findChatSuggestions: []})}}
                    joinChat={this.joinChat}
                    suggestions={this.state.findChatSuggestions}
                />
            </li>
        );

        const summaryItems = messagesArray.map((item) => {
            // item[1] is the message array
            const hasActivity = (item[1].length > 0);
            const lastMessage = hasActivity ? item[1][item[1].length-1] : null;

            return (
                <li key={item[0]}>
                    <ChatSummary 
                        chatid={item[0]} 
                        name={this.state.chatNameMap.get(item[0])}
                        hasActivity={hasActivity} 
                        lastMessage={lastMessage}
                        isSelected={this.state.selectedChatid == item[0]}
                        onClicked={this.onSummaryClicked}
                        leaveChat={this.leaveChat}
                    />
                </li>
            );
        });

        const selectedChatMessages = this.state.messageMap.get(this.state.selectedChatid);

        console.log('called app.render: selectedChatMessages = ');
        console.log(selectedChatMessages);
        console.log('and selectedChatid = ' + this.state.selectedChatid);

        const chatItem = (this.state.selectedChatid == null) ?
            <NullChat/> : 
            (selectedChatMessages === undefined) ? 
            (<p>Loading...</p>) :
            <Chat
                chatid={this.state.selectedChatid} 
                name={this.state.chatNameMap.get(this.state.selectedChatid)}
                messages={selectedChatMessages} 
                requestNewMessage={this.requestNewMessage}
            />
        ;

        return (
            <div className="app">
                <AlertContainer ref={obj => this.msg = obj} {...this.alertOptions} />
                <div className="app-header">
                    <AppHeader/>
                </div>
                <div className="app-main">
                    <div className="panel-summaries">
                        <ul>{[findChatInput].concat(summaryItems)}</ul>
                    </div>
                    <div className="panel-chat">
                        {chatItem}
                    </div>
                </div>
            </div>
        );
    }
}

export { App };
