# import libraries
import datetime 
from datetime import timedelta
import icalendar
import json
import os 
import pytz

# get timezone for sydney
sydney_timezone = pytz.timezone('Australia/Sydney')

# create function to extract dates relavent to today from given ics file
def events_today(ics_file, date):
  # read ics file
  cal = icalendar.Calendar.from_ical(open(ics_file, 'rb').read())

  # create lists to return
  events_today = []
  events_location = []
  events_teacher = []
  events_period = []
  events_start = []
  events_end = []

  # go through entire dataset
  for component in cal.walk():
    if component.name == "VEVENT":
        # get start date and time
        start_date = component.get('dtstart').dt

        # convert start date and time to sydney time
        start_date = start_date.replace(tzinfo=pytz.utc)
        sydney_start = start_date.astimezone(sydney_timezone)

        if sydney_start.date() == date:
            # get end date and time
            end_date = component.get('dtend').dt
            
            # convert end date and time to sydney time
            end_date = end_date.replace(tzinfo=pytz.utc)
            sydney_end = end_date.astimezone(sydney_timezone)

            # append to list as STRINGS
            events_today.append(component.get('summary'))
            events_location.append(component.get('location'))
            events_start.append(sydney_start.strftime("%Y-%m-%d %H:%M:%S"))
            events_end.append(sydney_end.strftime("%Y-%m-%d %H:%M:%S"))

            temp = component.get('description')
            events_teacher.append(temp.splitlines()[0])
            events_period.append(temp.splitlines()[1])

  return events_today, events_location, events_teacher, events_period, events_start, events_end

# inputs ics and json file path
ics_file_path = os.path.join('99.95','backend', 'Aarav.ics')
json_path = "99.95/backend/output.json"

# open json file for writing
with open(json_path , "w") as f:
   json.dump([], f, indent=4)

# copy json file as a variable list
with open (json_path) as f:
   data = json.load(f)

# appends all dates in ical to ical_dates_temp
cal = icalendar.Calendar.from_ical(open(ics_file_path, 'rb').read())
ical_dates = []
for component in cal.walk():
   if component.name == "VEVENT":
      tempdate = component.get('dtstart').dt
      tempdate = tempdate.replace(tzinfo=pytz.utc)
      tempdatesyd = tempdate.astimezone(sydney_timezone)

      ical_dates.append(tempdatesyd.date())

# find no. of days between first and last event
d0 = ical_dates[0]
d1 = ical_dates[len(ical_dates) - 1]
delta = d1 - d0

# parse function through all dates in ics file
for i in range(delta.days + 1):
   parsed_date = ical_dates[0] + timedelta(days=i)
   todays_events, todays_locations, todays_teacher, todays_period, todays_start, todays_end = events_today(ics_file_path, parsed_date)
   for j in range(len(todays_events)):
      print(todays_events[j], 'in', todays_locations[j], 'with', todays_teacher[j], todays_period[j], 'from', todays_start[j], 'to', todays_end[j])
      temp = {"Class": todays_events[j], "Location": todays_locations[j], "Teacher": todays_teacher[j], "Period": todays_period[j] ,"Start Time": todays_start[j], "End Time": todays_end[j]}
      data.append(temp)
   print("\n***\n")

# copy variable list back to json file
with open(json_path, 'w') as f:
   json.dump(data, f, indent=4)

