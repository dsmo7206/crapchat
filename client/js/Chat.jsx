import React from "react";
import { ChatMessage } from "./ChatMessage";

class Chat extends React.Component {
    constructor() {
        super();
        this.inputOnKeyDown = this.inputOnKeyDown.bind(this);
    }

    inputOnKeyDown(event) {
        if (event.keyCode != 13) {
            return; // We only care if Enter was pressed
        }
        this.props.requestNewMessage(this.props.chatid, event.target.value);
        event.target.value = ''; // Clear the input
    }

    render() {
        const listItems = this.props.messages.map((item, i) => {
            console.log('usernamemap is');
            console.log(this.props.usernameMap);
            console.log('item is');
            console.log(item);
            return (
                <li key={i}>
                    <ChatMessage 
                        user={this.props.usernameMap.get(item.userid)} 
                        write_time={item.write_time} 
                        text={item.text}
                    />
                </li>
            );
        });

        return (
            <div className="chat">
                <div className="chat-heading">
                    {this.props.name}: got {this.props.messages.length} messages!
                </div>
                <div className="chat-messages">
                    <ul>{listItems}</ul>
                </div>
                <input className="chat-input" placeholder="Enter your message..." onKeyDown={this.inputOnKeyDown}/>
            </div>
        );
    }
}

export { Chat };
