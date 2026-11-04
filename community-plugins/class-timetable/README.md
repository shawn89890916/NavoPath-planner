# Class Timetable / 课表

Imports a JSON array of {title,date,startTime,endTime,location?}. Dates use YYYY-MM-DD, times HH:mm. Courses and self-study are fixed timeline backgrounds. Tasks retain the host creation, move and resize interactions and may overlap classes. Repeated imports skip matching date/time/title entries. Repeat weekly is on by default, without an end date or holiday exceptions. Turn it off for one-week imports.

导入 JSON 后，课程与自习按真实起止时间显示在现有日/三日/周时间轴，可在背景上安排任务。默认每周重复，不设结束日期，节假日不自动跳过。停用隐藏背景但保留数据，重新启用恢复。通过课表标题查看详情。导入不发送到外部服务；沿用宿主账户同步。

Requires the calendar.registerBackground host capability introduced with this submission, hence minAppVersion 1.6.2-beta.1. Older apps cannot run this package. This source and its package contain no personal timetable or credentials. JSON/PDF recognition and automatic elective inference are outside this package; prepare a personal JSON timetable before import.
