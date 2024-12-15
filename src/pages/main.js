import React, { useState, useEffect, Component } from 'react';
import Markdown from 'markdown-to-jsx';

export default class Main extends Component {
    constructor(props) {
        super(props);
        this.state = { post: '' };
    }

    componentDidMount() {
        const fileName = this.props.fileName;
        import(`../data/${fileName}.md`)
            .then((res) => {
                fetch(res.default)
                    .then((res) => res.text())
                    .then((res) => this.setState({ post: res }))
                    .catch((err) => console.log(err));
            })
            .catch((err) => console.log(err));
    }

    render() {
        return (
            <div className="cardbox">
                <Markdown>{this.state.post}</Markdown>
            </div>
        );
    }
}
