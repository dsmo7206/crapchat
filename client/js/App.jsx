import React from "react";
import AlertContainer from "react-alert";

import { AppHeader } from "./AppHeader";
import { Chat } from "./Chat";
import { ChatSummary } from "./ChatSummary";
import { LoginPage } from "./LoginPage";
import { NullChat } from "./NullChat";
import { UserFinder } from "./UserFinder";

class App extends React.Component {
    constructor() {
        super();

        this.state = {
            connected: false,
            chatMessagesMap: new Map(), 
            chatNameMap: new Map(),
            chatUsersMap: new Map(),
            usernameMap: new Map(),
            selectedChatid: null,
            findUserSuggestions: [],
            today: new Date(),
            userid: null // Who we are logged in as, if at all
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
        this.tryLogin = this.tryLogin.bind(this);
        this.logout = this.logout.bind(this);
        this.onLoginResponse = this.onLoginResponse.bind(this);
        this.startChat = this.startChat.bind(this);
        this.leaveChat = this.leaveChat.bind(this);
        this.requestNewMessage = this.requestNewMessage.bind(this);
        this.onSummaryClicked = this.onSummaryClicked.bind(this);
        this.requestUserSuggestions = this.requestUserSuggestions.bind(this);
        this.getChatName = this.getChatName.bind(this);
    }

    componentDidMount() {
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

        if (data.type === 'user_suggestions')
        {
            this.setState({findUserSuggestions: data.data});
        }
        else if (data.type === 'data_update')
        {
            let chatMessagesMap = new Map(this.state.chatMessagesMap);
            let chatNameMap = new Map(this.state.chatNameMap);
            let chatUsersMap = new Map(this.state.chatUsersMap);
            let usernameMap = new Map(this.state.usernameMap);

            for (let i = 0; i < data.chat_data.length; ++i)
            {
                const chatid = data.chat_data[i].chatid;
                chatMessagesMap.set(chatid, data.chat_data[i].messages);
                chatNameMap.set(chatid, data.chat_data[i].name);
                chatUsersMap.set(chatid, data.chat_data[i].users);
            }

            for (let i = 0; i < data.user_data.length; ++i)
            {
                usernameMap.set(data.user_data[i].userid, data.user_data[i]);
            }

            this.setState({chatMessagesMap: chatMessagesMap});
            this.setState({chatNameMap: chatNameMap});
            this.setState({chatUsersMap: chatUsersMap});
            this.setState({usernameMap: usernameMap});
        }
        else if (data.type === 'new_message')
        {
            let chatMessagesMap = new Map(this.state.chatMessagesMap);
            chatMessagesMap.set(data.chatid, chatMessagesMap.get(data.chatid).concat(data.data));
            this.setState({chatMessagesMap: chatMessagesMap});
        }
        else
        {
            console.error('Got invalid data.type: ' + data.type);
        }
    }

    tryLogin(username, password) {
        let request = new XMLHttpRequest();
        request.open('POST', '/login', true); // "true" means async

        const app = this; // Create reference for callback below

        request.onreadystatechange = function() {
            if (request.readyState != 4)
            {
                return; // Ignore until done
            }
            app.onLoginResponse(request.status, request.statusText, JSON.parse(request.response));
        }
        request.setRequestHeader('Authorization', username + ':' + password);
        request.send();
    }

    logout() {
        this.socket.send('logout');
        this.setState({userid: null}); // This will cause the LoginPage to render
    }

    onLoginResponse(status, statusText, response) {
        if (status != 200)
        {
            this.loginPage.onLoginFail(statusText);
            return;
        }

        // Success!
        this.loginPage.onLoginSuccess();

        // We use the non-nullness of the userid to indicate that we are logged in
        this.setState({userid: response.userid});

        this.socket = new WebSocket(
            ((window.location.protocol === "https:") ? 'wss://' : 'ws://') + 
            window.location.host + "/client?access_token=" + response.token
        );
        this.socket.onmessage = this.onSocketMessage;

        this.socket.onopen = () => { 
            this.setState({connected: true});
        };

        this.socket.onclose = () => {
            this.setState({connected: false});
            this.socket = null;
        }
    }

    startChat(userid) {
        // Call this when we are starting a new chat with a user
        for (let [chatid, chat] of this.state.chatMessagesMap)
        {
            const usersInChat = this.state.chatUsersMap.get(chatid);

            // If we are in an exclusive chat with this person, we can't start another
            if (usersInChat.length == 2 && usersInChat.indexOf(userid) >= 0)
            {
                this.showError('You already have an open chat with this user!');
                return;
            }
        }

        // Start a new chat containing the current user and the other user
        this.socket.send(
            JSON.stringify({'type': 'start_chat', 'userids': [this.state.userid, userid]})
        )
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

        let chatMessagesMap = new Map(this.state.chatMessagesMap);
        chatMessagesMap.delete(chatid);
        this.setState({chatMessagesMap: chatMessagesMap});
    }

    onSummaryClicked(chatid) {
        this.setState({selectedChatid: chatid});
    }

    requestNewMessage(chatid, message) {
        this.socket.send(JSON.stringify({
            'type': 'new_message', 
            'chatid': chatid, 
            'message': message
        }));
    }

    requestUserSuggestions(searchString) {
        this.socket.send(JSON.stringify({
            'type': 'get_user_suggestions',
            'searchString': searchString
        }));
    }

    getChatName(chatid) {
        const chatName = this.state.chatNameMap.get(chatid);
        if (chatName != null)
        {
            return chatName;
        }

        // Null chatName so we should show the chat name as a combination
        // of the real names of the users in the chat excluding the current user.
        const chatUsers = this.state.chatUsersMap.get(chatid);

        if (chatUsers === undefined)
        {
            return '(Unknown)';
        }

        const otherUserids = chatUsers.filter(
            (userid) => { return userid != this.state.userid; }
        );

        if (otherUserids.length == 0)
        {
            return '(Only you)';
        }

        return otherUserids.map(
            (userid) => { 
                const userInfo = this.state.usernameMap.get(userid);
                return (userInfo == undefined) ? '(Unknown)' : userInfo.realname;
            }
        ).join(', ');
    }

    render() {
        if (this.state.userid == null)
        {
            // The user has not logged in yet
            return (
                <div className="app">
                    <LoginPage tryLogin={this.tryLogin} ref={(obj) => {this.loginPage = obj;}}/>
                </div>
            );
        }

        if (!this.state.connected)
        {
            return <div>Not connected</div>;
        }

        const messagesArray = Array.from(this.state.chatMessagesMap.entries());

        const findChatInput = (
            <li key="findUser">
                <UserFinder 
                    requestUserSuggestions={this.requestUserSuggestions}
                    onSuggestionsClearRequested={() => {this.setState({findUserSuggestions: []})}}
                    startChat={this.startChat}
                    suggestions={this.state.findUserSuggestions}
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
                        name={this.getChatName(item[0])}
                        today={this.state.today}
                        hasActivity={hasActivity} 
                        lastMessage={lastMessage}
                        isSelected={this.state.selectedChatid == item[0]}
                        onClicked={this.onSummaryClicked}
                        leaveChat={this.leaveChat}
                    />
                </li>
            );
        });

        const selectedChatMessages = this.state.chatMessagesMap.get(this.state.selectedChatid);

        const chatItem = (this.state.selectedChatid == null) ?
            <NullChat/> : 
            (selectedChatMessages === undefined) ? 
            (<p>Loading...</p>) :
            <Chat
                chatid={this.state.selectedChatid} 
                name={this.getChatName(this.state.selectedChatid)}
                messages={selectedChatMessages} 
                usernameMap={this.state.usernameMap}
                requestNewMessage={this.requestNewMessage}
            />
        ;

        return (
            <div className="app">
                <AlertContainer ref={obj => this.msg = obj} {...this.alertOptions} />
                <AppHeader logout={this.logout}/>
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
