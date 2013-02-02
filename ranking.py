
import json
import numpy as np
import pandas as pd
import igraph as ig
import statsmodels.api as sm
from patsy import dmatrices, dmatrix

# Data Available from: http://armchairanalysis.com/nfl-play-by-play-data.php
games = pd.read_csv('GameIndex.csv', index_col=0)

games['Winner'] = games.apply(lambda r: r['H'] if r['PTS/H'] >= r['PTS/V'] else r['V'], axis=1)
games['Loser'] = games.apply(lambda r: r['V'] if r['PTS/H'] >= r['PTS/V'] else r['H'], axis=1)
games['Homewin'] = games['PTS/H'] >= games['PTS/V']


def make_graph(df):
    teams = sorted(df['H'].unique())
    # convert teams to ints for igraph
    vids = {team: i for i, team in enumerate(teams)}
    edges = [(vids[winner], vids[loser]) 
             for (winner, loser) in df[['Winner', 'Loser']].itertuples(index=False)]
    
    return ig.Graph(edges=edges, directed=True, vertex_attrs={'name': teams})

def make_matrix(df):
    teams = sorted(df['H'].unique())
    # convert teams to ints for igraph
    ids = {team: i for i, team in enumerate(teams)}
    m = np.zeros((len(ids), len(ids)))

    for w, l in df[['Winner', 'Loser']].itertuples(index=False):
        m[ids[w],ids[l]] = 1
        
    return m

def pagerank(g):
    values = g.pagerank()
    g_pr = {vert['name']: val for vert, val in zip(g.vs, values)}
    return {key: i for i, (key, v) in enumerate(sorted(g_pr.iteritems(), key=lambda x: x[1]))}

def powermethod(m, iters=100, x0=None):
    if x0 == None:
        x0 = np.ones(m.shape[0])
        x0 /= np.linalg.norm(x0, 1)

    for i in range(iters):
        x0 = np.dot(m,x0)
        x0 /= np.linalg.norm(x0,1)

    return x0


def optimalrank(g):
    g = g.copy() # we are going to mutate the graph
    feedback_arcs = g.feedback_arc_set(method='exact')
    g.delete_edges(feedback_arcs)
    g_sort = g.topological_sorting()
    return {g.vs[ix]['name']: i for i, ix in enumerate(g_sort)}

def regrank(df):
    teams = list(sorted(df['H'].unique()))
    dummies = dict((team, (df['H'] == team).astype(np.int) - (df['V'] == team).astype(np.int)) 
                   for team in teams)
    df2 = pd.DataFrame(dummies)
    df2['pdiff'] = df['PTS/H'] - df['PTS/V']

    y, X = dmatrices('pdiff ~  %s' % ' + '.join(teams[:-1]), df2)
    results = sm.OLS(y, X).fit()

    strengths = {name: val for name, val in zip(teams, np.append(results.params[1:], 0))}

    return {key: i for i, (key, v) in enumerate(sorted(strengths.iteritems(), key=lambda x: -x[1]))}

def logitrank(df):
    teams = list(sorted(df['H'].unique()))
    dummies = dict((team, (df['H'] == team).astype(np.int) - (df['V'] == team).astype(np.int)) 
                   for team in teams)
    df2 = pd.DataFrame(dummies)
    df2['pdiff'] = df['PTS/H'] - df['PTS/V']

    y, X = dmatrices('I(pdiff>0) ~  %s' % ' + '.join(teams[:-1]), df2)
    results = sm.GLM(y, X, family=sm.families.Binomial()).fit()

    strengths = {name: val for name, val in zip(teams, np.append(results.params[1:], 0))}

    return {key: i for i, (key, v) in enumerate(sorted(strengths.iteritems(), key=lambda x: x[1]))}

def eval_rank(df, ranks, home_boost=0):
    """
    Home boost ranks the home team higher.
    """
    teams = list(ranks.iterkeys())
    rank_df = pd.DataFrame({'team': teams, 'rank': [ranks[team] for team in teams]})
    joined = pd.merge(pd.merge(df, rank_df, left_on='H', right_on='team'), 
                      rank_df, 
                      left_on='V',
                      right_on='team',
                      suffixes=('.home', '.away'))

    predict_homewin = (joined['rank.home'] - home_boost) < joined['rank.away']
    homewin = joined['Homewin']
    correct = sum(predict_homewin*homewin + (1 - predict_homewin)*(1 - homewin))

    return correct
    
def compare_rankings():
    for year in range(2002, 2011):
        season = games[(games['SEAS'] == year) & (games['WEEK'] < 18)]
        rank0 = logitrank(season)
        g = make_graph(season)
        rank1 = pagerank(g)
        rank2 = optimalrank(g)
        print '%i %.2f %.2f %.2f' % (year, eval_rank(season, rank0)/256., eval_rank(season, rank1)/256., eval_rank(season, rank2)/256.)

def output_d3(year, fn='web/nfl%i.json'):
    df = games[(games['SEAS'] == year) & (games['WEEK'] < 18)]

    g = make_graph(df)
    oranks = optimalrank(g)
    branks = logitrank(df)

    nodes = [dict(name=t['name'], group=1, 
                  orank=oranks[t['name']], 
                  brank=branks[t['name']]) for t in g.vs]
    fas = set(g.feedback_arc_set(method='exact'))
    links = [dict(source=e.source, target=e.target, value=1,  fas=1 if e.index in fas else 0) 
             for e in g.es]

    with open(fn % year, 'w') as f:
        json.dump({'nodes': nodes, 'links': links}, f)
