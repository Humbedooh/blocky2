#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import subprocess
import re
import json
import requests
import netaddr
import asfpy.daemon
import yaml
import socket
import time
import sys
import argparse
import syslog

DEBUG = False
CONFIG = None
SYSLOG = None
MAX_IPTABLES_TRIES = 10
IPTABLES_EXEC = '/sbin/iptables'
IP6TABLES_EXEC = '/sbin/ip6tables'
LAST_UPLOAD = 0

def getbans(chain = 'INPUT'):
   """ Gets a list of all bans in a chain """
   banlist = []
   
   # Get IPv4 list
   for i in range(0,MAX_IPTABLES_TRIES):
      try:
         out = subprocess.check_output([IPTABLES_EXEC, '--list', chain, '-n', '--line-numbers'], stderr = subprocess.STDOUT)
      except subprocess.CalledProcessError as err:
         if 'you must be root' in err.output:
            print("Looks like blocky doesn't have permission to access iptables, giving up completely! (are you running as root?)")
            sys.exit(-1)
         time.sleep(1) # write lock, probably
      if out:
         for line in out.split("\n"):
            m = re.match(r"^(\d+)\s+([A-Z]+)\s+(all|tcp|udp)\s+(\S+)\s+([0-9a-f.:/]+)\s+([0-9a-f.:/]+)\s*(.*?)$", line)
            if m:
               ln = m.group(1)
               action = m.group(2)
               protocol = m.group(3)
               option = m.group(4)
               source = m.group(5)
               destination = m.group(6)
               extensions = m.group(7)
               
               entry = {
                  'chain': chain,
                  'linenumber': ln,
                  'action': action,
                  'protocol': protocol,
                  'option': option,
                  'source': source,
                  'destination': destination,
                  'extensions': extensions,
               }
               
               banlist.append(entry)
         break
   # Get IPv6 list
   if not os.path.exists(IP6TABLES_EXEC):
      return banlist
   for i in range(0,MAX_IPTABLES_TRIES):
      try:
         out = subprocess.check_output([IP6TABLES_EXEC, '--list', chain, '-n', '--line-numbers'], stderr = subprocess.STDOUT)
      except subprocess.CalledProcessError as err:
         if 'you must be root' in err.output:
            print("Looks like blocky doesn't have permission to access iptables, giving up completely! (are you running as root?)")
            sys.exit(-1)
         time.sleep(1) # write lock, probably
      if out:
         for line in out.split("\n"):
            # Unlike ipv4 iptables, the 'option' thing is blank here, so omit it
            m = re.match(r"^(\d+)\s+([A-Z]+)\s+(all|tcp|udp)\s+([0-9a-f.:/]+)\s+([0-9a-f.:/]+)\s*(.*?)$", line)
            if m:
               ln = m.group(1)
               action = m.group(2)
               protocol = m.group(3)
               source = m.group(4)
               destination = m.group(5)
               extensions = m.group(6)
               
               entry = {
                  'chain': chain,
                  'linenumber': ln,
                  'action': action,
                  'protocol': protocol,
                  'option': '---',
                  'source': source,
                  'destination': destination,
                  'extensions': extensions,
               }
               
               banlist.append(entry)
         break
   return banlist
      
def iptables(ip, action):
    """ Runs an iptables action on an IP (-A, -C or -D), returns true if
        succeeded, false otherwise """
    try:
        exe = IPTABLES_EXEC
        if ':' in ip:
            exe = IP6TABLES_EXEC
        subprocess.check_call([
            exe,
            action, "INPUT",
            "-s", ip,
            "-j", "DROP",
            "-m", "comment",
            "--comment",
            "Banned by Blocky/2.0"
        ], stderr=open(os.devnull, 'wb'))
    except subprocess.CalledProcessError as err: # iptables error, expected result variant
        return False
    except OSError as err:
        print("%s not found or inaccessible: %s" % (exe, err))
        return False
    return True
   

def ban(ip):
   """ Bans an IP or CIDR block generically """
   if iptables(ip, '-A'):
      return True
   return False

def unban_line(ip, linenumber, chain = 'INPUT'):
    """ Unbans an IP or block by line number """
    if not linenumber:
      return
    exe = IPTABLES_EXEC
    if ':' in ip:
      exe = IP6TABLES_EXEC
    if DEBUG:
      print("Would have removed line %s from %s chain in iptables here..." % (linenumber, chain))
      return True
    try:
        subprocess.check_call([
            exe,
            '-D', chain, linenumber
        ], stderr=open(os.devnull, 'wb'))
    except subprocess.CalledProcessError as err: # iptables error, expected result variant
        return False
    except OSError as err:
        print("%s not found or inaccessible: %s" % (exe, err))
        return False
    return True

def inlist(banlist, ip):
   """ Check if an IP or CIDR is listed in iptables,
   either by itself or contained within a block (or the reverse) """
   lines = []
   if '/0' in ip: # DO NOT WANT
      return lines
   # First, check verbatim
   for entry in banlist:
      if entry['source'] == ip:
         lines.append(entry)
   # Check if block, then check for matches within
   if '/' in ip:
      me = netaddr.IPNetwork(ip)
      for entry in banlist:
         source = entry['source']
         if '/' not in source: # We don't want to do block vs block just yet
            them = netaddr.IPAddress(source)
            if them in me:
               lines.append(entry)
   
   # Then the reverse; IP found within blocks?
   else:
      me = netaddr.IPAddress(ip)
      for entry in banlist:
         if '/' in entry['source'] and '/0' not in entry['source']: # blocks, but not /0
            them = netaddr.IPNetwork(entry['source'])
            if me in them:
               lines.append(entry)
   return lines

def note_ban(me, entry):
   apiurl = "%s/note" % CONFIG['server']['apiurl']
   try:
      requests.post(apiurl, json = {
         'hostname': me,
         'action': 'ban',
         'ip': entry['source'],
         'reason': entry.get('reason', "No reason specified")
      })
   except request.RequestException:
      pass # If it fails with a http error, it fails - we'll continue anyway
           # Not sure if we should even syslog that..

def note_unban(me, entry):
   apiurl = "%s/note" % CONFIG['server']['apiurl']
   try:
      requests.post(apiurl, json = {
         'hostname': me,
         'action': 'unban',
         'ip': entry['source'],
         'reason': entry.get('reason', "No reason specified")
      })
   except requests.RequestException:
      pass # If it fails, it fails - we'll continue anyway
           # Not sure if we should even syslog that..

def run_legacy_checks():
   """ Runs checks using the legacy blocky UI server (mod_lua) """
   apiurl = CONFIG['server']['legacyurl']
   actions = []
   mylist = getbans()
   try:
      actions = requests.get(apiurl).json()
      syslog.syslog(syslog.LOG_INFO, "Fetched a total of %u firewall actions from %s" % (len(actions), apiurl))
   except:
      syslog.syslog(syslog.LOG_WARNING, "Could not retrieve blocky actions list from %s - server down??!" % apiurl)
   
   whitelist = [] # Things we are unbanning, and thus shouldn't just ban right again
   
   # For each action element, find out what to do, and who to do it to.
   for action in actions:
      
      # Unban request
      target = action.get('target', '*')
      if 'unban' in action:
         if target == '*' or target == CONFIG['client']['hostname']:
            ip = action.get('ip')
            if ip:
               ip = ip.strip()
               block = None
               if '/' in ip:
                  block = netaddr.IPNetwork(ip)
               else:
                  if ':' in ip:
                     block = netaddr.IPNetwork("%s/128" % ip) # IPv6
                  else:
                     block = netaddr.IPNetwork("%s/32" % ip)  # IPv4
               whitelist.append(block)
               found = inlist(mylist, ip)
               if found:
                  entry = found[0]
                  syslog.syslog(syslog.LOG_INFO, "Removing %s from block list (found at line %s as %s)" % (ip, entry['linenumber'], entry['source']))
                  if not unban_line(ip, found[0]['linenumber']):
                     syslog.syslog(syslog.LOG_WARNING, "Could not remove ban for %s from iptables!" % ip)
                  else:
                     mylist = getbans() # Refresh after action succeeded
                     
      # Ban request?
      elif 'ip' in action:
         if target == '*' or target == CONFIG['client']['hostname']:
            ip = action.get('ip')
            if ip:
               ip = ip.strip() # backwards compat
               banit = True
               block = None
               if '/' in ip:
                  block = netaddr.IPNetwork(ip)
               else:
                  if ':' in ip:
                     block = netaddr.IPNetwork("%s/128" % ip) # IPv6
                  else:
                     block = netaddr.IPNetwork("%s/32" % ip)  # IPv4
               for wblock in whitelist:
                  if block in wblock or wblock in block:
                     syslog.syslog(syslog.LOG_WARNING, "%s was requested banned but %s is whitelisted, ignoring ban" % (block, wblock))
                     banit = False
               if banit:
                  found = inlist(mylist, ip)
                  if not found:
                     reason = action.get('reason', "No reason specified")
                     syslog.syslog(syslog.LOG_INFO, "Adding %s to block list; %s" % (ip, reason))
                     if not ban(ip):
                        syslog.syslog(syslog.LOG_WARNING, "Could not add ban for %s in iptables!" % ip)
                     else:
                        mylist = getbans() # Refresh after action succeeded
                        
def run_new_checks():
   """ Runs the blocky process using the modern UI server """
   global LAST_UPLOAD
   
   # First, get our rules and post 'em to the server, if need be
   mylist = getbans()
   if LAST_UPLOAD < (time.time() - 600): # Only send once every ten minutes
      try:
         rv = None
         js = {
            'hostname': CONFIG['client']['hostname'],
            'iptables': mylist
         }
         apiurl = "%s/myrules" % CONFIG['server']['apiurl']
         rv = requests.put(apiurl, json = js)
         assert(rv.status_code == 200)
         LAST_UPLOAD = time.time()
      except requests.RequestException:
         if rv:
            syslog.syslog(syslog.LOG_WARNING, rv.text)
         syslog.syslog(syslog.LOG_WARNING, "Could not send my iptables list to server at %s - server down?" % apiurl)

   # Then, get applicable actions from the server
   whitelist = []
   whiteblocks = [] # same as above, but as IPNetwork classes
   banlist = []
   try:
      whiteurl = "%s/whitelist" % CONFIG['server']['apiurl']
      whitelist = requests.get(whiteurl).json()['whitelist']
   except requests.RequestException:
      syslog.syslog(syslog.LOG_WARNING, "Could not fetch whitelist entries at %s - server down?" % whiteurl)
   try:
      banurl = "%s/bans" % CONFIG['server']['apiurl']
      banlist = requests.get(banurl).json()['bans']
   except requests.RequestException:
      syslog.syslog(syslog.LOG_WARNING, "Could not fetch whitelist entries at %s - server down?" % banurl)
   
   # First, check if we've banned someone on the whitelist
   for entry in whitelist:
      ip = entry.get('ip')
      reason = entry.get('reason', 'No reason specified')
      target = entry.get('target', '*')
      if target == '*' or target == CONFIG['client']['hostname']:
         if ip:
            block = None
            if '/' in ip:
               block = netaddr.IPNetwork(ip)
            else:
               if ':' in ip:
                  block = netaddr.IPNetwork("%s/128" % ip) # IPv6
               else:
                  block = netaddr.IPNetwork("%s/32" % ip)  # IPv4
               whiteblocks.append(block)
               found = inlist(mylist, ip)
               if found:
                  entry = found[0]
                  syslog.syslog(syslog.LOG_INFO, "Removing %s from block list (found at line %s as %s)" % (ip, entry['linenumber'], entry['source']))
                  if not unban_line(ip, found[0]['linenumber']):
                     syslog.syslog(syslog.LOG_WARNING, "Could not remove ban for %s from iptables!" % ip)
                  else:
                     note_unban(CONFIG['client']['hostname'], found[0]['linenumber'])
                     mylist = getbans() # Refresh after action succeeded
   
   # Then process bans
   for entry in banlist:
      ip = entry.get('ip')
      reason = entry.get('reason', 'No reason specified')
      target = entry.get('target', '*')
      if ip:
         if target == '*' or target == CONFIG['client']['hostname']:
            banit = True
            block = None
            if '/' in ip:
               block = netaddr.IPNetwork(ip)
            else:
               if ':' in ip:
                  block = netaddr.IPNetwork("%s/128" % ip) # IPv6
               else:
                  block = netaddr.IPNetwork("%s/32" % ip)  # IPv4
            for wblock in whiteblocks:
               if block in wblock or wblock in block:
                  syslog.syslog(syslog.LOG_WARNING, "%s was requested banned but %s is whitelisted, ignoring ban" % (block, wblock))
                  banit = False
            if banit:
               found = inlist(mylist, ip)
               if not found:
                  reason = entry.get('reason', "No reason specified")
                  syslog.syslog(syslog.LOG_INFO, "Adding %s to block list; %s" % (ip, reason))
                  if not ban(ip):
                     syslog.syslog(syslog.LOG_WARNING, "Could not add ban for %s in iptables!" % ip)
                  else:
                     mylist = getbans() # Refresh after action succeeded
                     found = inlist(mylist, ip)
                     if found: # make sure we have it in iptables now
                        note_ban(CONFIG['client']['hostname'], found[0])
   # All done for this time!

def psyslog(a,b):
   """ nasty hack for copying syslog calls to stdout """
   SYSLOG(a, b)
   print("- " + b)
   
def run_daemon(stdout = False):
   global SYSLOG, CONFIG
   if stdout:
      SYSLOG = syslog.syslog
      syslog.syslog = psyslog
   else:
      syslog.openlog('blocky', logoption=syslog.LOG_PID, facility=syslog.LOG_LOCAL0)
      syslog.syslog(syslog.LOG_INFO, "Blocky/2 started")
   while True:
      # Fetch actions list - legacy or new
      if CONFIG['server'].get('legacyurl'):
         syslog.syslog(syslog.LOG_INFO, "Using legacy server component at %s" % CONFIG['server']['legacyurl'])
         run_legacy_checks()
      elif CONFIG['server'].get('apiurl'):
         syslog.syslog(syslog.LOG_INFO, "Using modern server component at %s" % CONFIG['server']['apiurl'])
         run_new_checks()
      if stdout:
         return
      time.sleep(CONFIG['client'].get('interval', 60))

def base_parser():
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("-x", "--user", help="not used (legacy compat)")
    arg_parser.add_argument("-y", "--group", help="not used (legacy compat)")
    arg_parser.add_argument("-u", "--unban", help="An IP or CIDR block to unban manually")
    arg_parser.add_argument("-b", "--ban", help="An IP or CIDR block to ban manually")
    arg_parser.add_argument("-d", "--daemonize", action = 'store_true', help="Run blocky as a daemon")
    arg_parser.add_argument("-s", "--stop", action = 'store_true', help="Stop blocky daemon")
    arg_parser.add_argument("-f", "--foreground", action = 'store_true', help="Run blocky in the foreground (debugging)")
    return arg_parser


def start_client():
   global CONFIG
   # Figure out who we are
   me = socket.gethostname()
   if 'apache.org' not in me:
      me += '.apache.org'
   
   # Load YAML
   CONFIG = yaml.load(open('./blocky.yaml').read())
   if 'client' not in CONFIG:
      CONFIG['client'] = {}
   if 'hostname' not in CONFIG['client']:
      CONFIG['client']['hostname'] = me
   
   # Get current list of bans in iptables, upload it to blocky server
   l = getbans()
   
   args = base_parser().parse_args()
   
   # CLI unban?
   if args.unban:
      ip = args.unban
      found = inlist(l, ip) # random test
      if found:
         entry = found[0] # Only get the first entry, line numbers will then change ;\
         print("Found a block for %s on line %s in the %s chain (as %s), removing..." % (ip, entry['linenumber'], entry['chain'], entry['source']))
         if unban_line(entry['linenumber']):
            print("Refreshing ban list...")
            l = getbans()
      else:
         print("%s wasn't found in iptables, nothing to do" % ip)
      return
   
   # CLI ban?
   if args.ban:
      ip = args.ban
      found = inlist(l, ip)
      if found:
         print("%s is already banned here as %s, nothing to do" % (ip, found[0]['source']))
      else:
         if ban(ip):
            print("IP %s successfully banned using generic ruleset" % ip)
         else:
            print("Could not ban %s, bummer" % ip)
      return
   
   # Daemon stuff?
   d = asfpy.daemon(run_daemon)
   
   # Start daemon?
   if args.daemonize:
      d.start()
   # stop daemon?
   elif args.stop:
      d.stop()
   elif args.foreground:
      run_daemon(True)

if __name__ == '__main__':
   start_client()

