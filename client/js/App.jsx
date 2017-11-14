import React from "react";
import { Chat } from "./Chat";
import { ChatSummary } from "./ChatSummary";
import { NullChat } from "./NullChat";

class App extends React.Component {
    constructor() {
        super();

        // messageMap maps a chatid (int) to an array of messages (strings)
        this.state = {messageMap: new Map(), selectedChatid: null};

        this.onSocketMessage = this.onSocketMessage.bind(this);
        this.joinChat = this.joinChat.bind(this);
        this.requestNewMessage = this.requestNewMessage.bind(this);
        this.onSummaryClicked = this.onSummaryClicked.bind(this);
    }

    componentDidMount() {
        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? "wss://" : "ws://") + 
            window.location.host + "/chat"
        );
        this.socket.onmessage = this.onSocketMessage;

        this.socket.onopen = () => { 
            this.joinChat(123); 
            this.joinChat(124); 
            this.joinChat(125); 
        };

        this.setState({selectedChatid: 123});
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
            console.log('got new message for chat ' + data.chatid + ': ' + data.data);
        }
        this.setState({messageMap: messageMap});
    }

    joinChat(chatid) {
        let messageMap = new Map(this.state.messageMap);
        messageMap.set(chatid, []);
        this.setState({messageMap: messageMap});
        this.socket.send(JSON.stringify({'type': 'refresh', 'chatid': chatid}));
    }

    onSummaryClicked(chatid) {
        this.setState({selectedChatid: chatid});
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

        console.log('Called App.render, selectedChatid=' + this.state.selectedChatid);

        const summaryItems = messagesArray.map((item) => {
            // item[1] is the message array
            const hasActivity = (item[1].length > 0);
            const lastMessage = hasActivity ? item[1][item[1].length-1] : null;

            return (
                <li key={item[0]}>
                    <ChatSummary 
                        chatid={item[0]} 
                        hasActivity={hasActivity} 
                        lastMessage={lastMessage}
                        isSelected={this.state.selectedChatid == item[0]}
                        onClicked={this.onSummaryClicked}
                    />
                </li>
            );
        });

        const selectedChatMessages = this.state.messageMap.get(this.state.selectedChatid);

        const chatItem = (this.state.selectedChatid == null) ? 
            <NullChat/> : 
            (selectedChatMessages === undefined) ? 
            (<p>Loading...</p>) :
            <Chat
                chatid={this.state.selectedChatid} 
                messages={selectedChatMessages} 
                requestNewMessage={this.requestNewMessage}
            />
        ;

        return (
            <div className="app">
                <div className="app-header">
                    <p>App header!</p>
                </div>
                <div className="app-main">
                    <div className="panel-summaries">
                        <ul>{summaryItems}</ul>
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
