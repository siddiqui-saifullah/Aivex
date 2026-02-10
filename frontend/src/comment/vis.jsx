// {/* Main Window Frame */}
//             <div className="relative bg-[#09090b] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col text-left h-[500px] md:h-[600px] transform rotate-x-2 transition-transform duration-700">
//               {/* Top Bar */}
//               <div className="h-10 border-b border-white/5 bg-[#18181b] flex items-center justify-between px-4">
//                 <div className="flex items-center gap-2">
//                   <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
//                   <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
//                   <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
//                 </div>
//                 <div className="flex items-center gap-3">
//                   <div className="px-3 py-1 rounded bg-[#27272a] text-xs text-zinc-400 border border-white/5 flex items-center gap-2">
//                     <Play size={10} className="fill-current" /> Preview
//                   </div>
//                   <div className="px-3 py-1 rounded bg-red-500/10 text-xs text-red-400 border border-red-500/20 flex items-center gap-2">
//                     <X size={10} /> Stop
//                   </div>
//                 </div>
//               </div>

//               {/* Main Content Area */}
//               <div className="flex-1 flex overflow-hidden">
//                 {/* 1. Chat Sidebar (Left) */}
//                 <div className="w-72 border-r border-white/5 bg-[#09090b] flex flex-col hidden md:flex">
//                   <div className="p-3 border-b border-white/5 text-xs font-medium text-zinc-400 flex items-center gap-2">
//                     <Bot size={14} className="text-teal-500" /> Aivex AI
//                   </div>
//                   <div className="flex-1 p-4 space-y-4 overflow-y-auto">
//                     {/* User Message */}
//                     <div className="self-end bg-[#00aeb0] text-black text-xs p-3 rounded-2xl rounded-br-sm ml-4">
//                       @Vex create an express server with EJS and visual pages
//                     </div>
//                     {/* AI Message */}
//                     <div className="self-start bg-zinc-800 text-zinc-300 text-xs p-3 rounded-2xl rounded-bl-sm mr-4 leading-relaxed">
//                       I have created a robust Express.js application using EJS
//                       for templating. The server is ready.
//                     </div>
//                   </div>
//                   <div className="p-3 border-t border-white/5">
//                     <div className="h-8 bg-zinc-900 rounded border border-white/5 flex items-center px-3 text-xs text-zinc-600">
//                       Ask Aivex...
//                     </div>
//                   </div>
//                 </div>

//                 {/* 2. File Explorer (Middle) */}
//                 <div className="w-48 border-r border-white/5 bg-[#09090b] flex flex-col hidden lg:flex">
//                   <div className="p-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">
//                     Explorer
//                   </div>
//                   <div className="flex-1 px-2 space-y-1">
//                     <FileItem
//                       name="package.json"
//                       color="text-red-400"
//                       icon={FileCode}
//                     />
//                     <FileItem
//                       name="index.js"
//                       color="text-yellow-400"
//                       icon={FileCode}
//                       active
//                     />
//                     <FolderItem name="middleware" />
//                     <FolderItem name="views" expanded>
//                       <FileItem
//                         name="index.ejs"
//                         color="text-orange-400"
//                         icon={Code2}
//                         indent
//                       />
//                       <FileItem
//                         name="error.ejs"
//                         color="text-orange-400"
//                         icon={Code2}
//                         indent
//                       />
//                     </FolderItem>
//                     <FolderItem name="public" />
//                   </div>
//                 </div>

//                 {/* 3. Code Editor (Right) */}
//                 <div className="flex-1 bg-[#09090b] flex flex-col">
//                   {/* Tabs */}
//                   <div className="flex border-b border-white/5 bg-[#09090b]">
//                     <div className="px-4 py-2 text-xs text-zinc-300 bg-[#18181b] border-r border-white/5 border-t-2 border-t-teal-500 flex items-center gap-2">
//                       <FileCode size={12} className="text-yellow-400" />{" "}
//                       index.js
//                     </div>
//                   </div>

//                   {/* Code Area */}
//                   <div className="p-6 font-mono text-sm leading-relaxed text-zinc-400 overflow-hidden">
//                     <div>
//                       <span className="text-purple-400">const</span> express ={" "}
//                       <span className="text-yellow-300">require</span>(
//                       <span className="text-green-400">"express"</span>);
//                     </div>
//                     <div>
//                       <span className="text-purple-400">const</span> app ={" "}
//                       <span className="text-blue-300">express</span>();
//                     </div>
//                     <div>
//                       <span className="text-purple-400">const</span> PORT ={" "}
//                       <span className="text-orange-400">3000</span>;
//                     </div>
//                     <div className="h-4"></div>
//                     <div className="text-zinc-500">// View Engine Setup</div>
//                     <div>
//                       app.<span className="text-blue-300">set</span>(
//                       <span className="text-green-400">"view engine"</span>,{" "}
//                       <span className="text-green-400">"ejs"</span>);
//                     </div>
//                     <div>
//                       app.<span className="text-blue-300">use</span>(express.
//                       <span className="text-blue-300">static</span>(
//                       <span className="text-green-400">"public"</span>));
//                     </div>
//                     <div className="h-4"></div>
//                     <div>
//                       app.<span className="text-blue-300">get</span>(
//                       <span className="text-green-400">"/"</span>, (req, res) =
//                       {">"} {"{"}
//                     </div>
//                     <div className="pl-4">
//                       res.<span className="text-blue-300">render</span>(
//                       <span className="text-green-400">"index"</span>);
//                     </div>
//                     <div>{"}"});</div>
//                     <div className="h-4"></div>
//                     <div>
//                       <span className="text-teal-500 animate-pulse">|</span>
//                     </div>
//                   </div>

//                   {/* Status Bar */}
//                   <div className="mt-auto h-6 bg-teal-500/10 border-t border-teal-500/20 flex items-center px-3 justify-between text-[10px] text-teal-400">
//                     <div className="flex items-center gap-2">
//                       <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
//                       Server Running: Port 3000
//                     </div>
//                     <div>JavaScript</div>
//                   </div>
//                 </div>
//               </div>
//             </div>
