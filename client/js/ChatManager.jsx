import React from "react";
import { Chat } from "./Chat";

class ChatManager extends React.Component {
    constructor() {
        super();

        // messageMap maps a chatid (int) to an array of messages (strings)
        this.state = {messageMap: new Map()};

        this.onSocketMessage = this.onSocketMessage.bind(this);
        this.createNewChat = this.createNewChat.bind(this);
        this.requestRefresh = this.requestRefresh.bind(this);
        this.requestNewMessage = this.requestNewMessage.bind(this);
    }

    componentDidMount() {
        // Move socket object up to ChatManager so the same universal socket
        // can handle more than one chat
        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? "wss://" : "ws://") + 
            window.location.host + "/chat"
        );
        this.socket.onmessage = this.onSocketMessage;

        this.socket.onopen = () => { 
            this.createNewChat(123); 
            this.createNewChat(124); 
        };
    }

    onSocketMessage(event) {
        const data = JSON.parse(event.data);
        let messageMap = new Map(this.state.messageMap);
        if (data.type === 'refresh')
        {
            messageMap.set(data.chatid, data.data);
        }
        else if (data.type === 'new_message')
        {
            messageMap.set(data.chatid, messageMap.get(data.chatid).concat(data.data));
        }
        this.setState({messageMap: messageMap});
    }

    createNewChat(chatid) {
        let messageMap = new Map(this.state.messageMap);
        messageMap.set(chatid, []);
        this.setState({messageMap: messageMap});
    }

    requestRefresh(chatid) {
        this.socket.send(JSON.stringify({'type': 'refresh', 'chatid': chatid}));
    }

    requestNewMessage(chatid, message) {
        this.socket.send(JSON.stringify({
            'type': 'new_message', 
            'chatid': chatid, 
            'message': {'user': 'Web User', 'text': message}
        }))
    }

    render() {
        const messagesArray = Array.from(this.state.messageMap.entries());
        const chatItems = messagesArray.map((item) => {
            return (
                <li key={item[0]}>
                    <Chat 
                        chatid={item[0]} 
                        messages={item[1]} 
                        requestRefresh={() => {this.requestRefresh(item[0])}}
                        requestNewMessage={this.requestNewMessage}
                    />
                </li>
            );
        });

        return (
            <div>
                <ul>{chatItems}</ul>
            </div>
        );
    }
}

export { ChatManager };
