import React from "react";

const Progress = (props: React.ProgressHTMLAttributes<HTMLProgressElement>) => (
  <progress
    {...props}
    className="rounded-full bg-gray-200 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-600 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600"
  />
);

export default Progress;
