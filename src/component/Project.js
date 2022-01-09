import React, { useState, useEffect } from 'react';
import Markdown from 'markdown-to-jsx';

function Project() {
    const file_name = 'Project.md';
    const [post, setPost] = useState('');

    useEffect(() => {
        import(`../data/${file_name}`)
            .then(res => {
                fetch(res.default)
                    .then(res => res.text())
                    .then(res => setPost(res))
                    .catch(err => console.log(err));
            })
            .catch(err => console.log(err));
    });

    return (
        <div className="cardbox">
            <Markdown>
                {post}
            </Markdown>
        </div>
    );
}

export default Project;