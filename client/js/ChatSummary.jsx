import React from "react";
import { dateToString } from "./common";

class ChatSummary extends React.Component {
    render() {
        const lastMessage = (
            this.props.hasActivity ? 
            this.props.lastMessage.text :
            '(No messages)'
        );

        const lastMessageTime = (
            this.props.hasActivity ?
            dateToString(this.props.lastMessage.write_time, this.props.today) :
            ''
        );

        const summaryClassName = (
            this.props.isSelected ? "chat-summary selected" : "chat-summary"
        );

        return (
            <div className={summaryClassName} onClick={() => {this.props.onClicked(this.props.chatid)}}>
                <div className="chat-summary-top">
                    <div className="chat-summary-top-title">
                        {this.props.name}
                    </div>
                    <div className="chat-summary-top-time">
                        {lastMessageTime}
                    </div>
                </div>
                <div className="chat-summary-bottom">
                    <div className="chat-summary-bottom-message">
                        {lastMessage}
                    </div>
                    <button className="chat-summary-bottom-button" onClick={(event) => {
                        this.props.leaveChat(this.props.chatid);
                        event.stopPropagation();
                    }}/>
                </div>
            </div>
        );
    }
}

export { ChatSummary };