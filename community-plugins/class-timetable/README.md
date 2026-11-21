# Class Timetable / 课表

Imports a JSON array of {title,date,startTime,endTime,location?}. Dates use YYYY-MM-DD, times HH:mm. Courses and self-study are fixed timeline backgrounds. Tasks retain the host creation, move and resize interactions and may overlap classes. Repeated imports skip matching date/time/title entries. Repeat weekly is on by default, without an end date or holiday exceptions. Turn it off for one-week imports.

导入 JSON 后，课程与自习按真实起止时间显示在现有日/三日/周时间轴，可在背景上安排任务。默认每周重复，不设结束日期，节假日不自动跳过。停用隐藏背景但保留数据，重新启用恢复。通过课表标题查看详情。导入不发送到外部服务；沿用宿主账户同步。

Version 1.0.1 runs on unmodified official NavoPath 1.6.2 via calendar.registerBackground. The manifest uses the plugin loader floor 1.5.2-beta.2 because released hosts currently hard-code that comparison version. An onload capability check rejects hosts without calendar backgrounds before any registration or data write. No host patch is required. This source and its package contain no personal timetable or credentials. JSON/PDF recognition and automatic elective inference are outside this package; prepare a personal JSON timetable before import.

在官方 1.6.2 上仅安装此插件即可运行，无需修改应用文件。入口：设置 → 插件 → Class Timetable 设置。旧宿主若没有课程背景接口，会在启动前提示升级，不写入数据。当前导入格式为 JSON，不包含自动 PDF 识别。
