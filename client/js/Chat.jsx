import React from "react";
import { ChatMessage } from "./ChatMessage";

class Chat extends React.Component {
    constructor() {
        super();
        this.inputOnKeyDown = this.inputOnKeyDown.bind(this);
    }

    componentDidMount() {
        this.props.requestRefresh();
    }

    inputOnKeyDown(event) {
        if (event.keyCode != 13) {
            return; // We only care if Enter was pressed
        }

        console.log('Pressed enter; text is "' + event.target.value + '"');
        this.props.requestNewMessage(this.props.chatid, event.target.value);
    }

    render() {
        const listItems = this.props.messages.map((item, i) => {
            return <li key={i}><ChatMessage user={item.user} time={item.time} text={item.text}/></li>
        });

        return (
            <div className="chat">
                <div className="chat-heading">
                    Chat {this.props.chatid}: got {this.props.messages.length} messages!
                </div>
                <div className="chat-messages">
                    <ul>{listItems}</ul>
                </div>
                <div className="chat-input">
                    <input onKeyDown={this.inputOnKeyDown}/>
                </div>
            </div>
        );
    }
}

export { Chat };
