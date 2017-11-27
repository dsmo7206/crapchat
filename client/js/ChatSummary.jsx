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
            this.props.isSelected ? "summary selected" : "summary"
        );

        return (
            <div className={summaryClassName} onClick={() => {this.props.onClicked(this.props.chatid)}}>
                <div className="top">
                    <div className="title">
                        {this.props.name}
                    </div>
                    <div className="time">
                        {lastMessageTime}
                    </div>
                </div>
                <div className="bottom">
                    <div className="message">
                        {lastMessage}
                    </div>
                    <button className="button" onClick={(event) => {
                        this.props.leaveChat(this.props.chatid);
                        event.stopPropagation();
                    }}/>
                </div>
            </div>
        );
    }
}

export { ChatSummary };