VII/165A    Measured Redshifts of Abell Clusters of Galaxies   (Andernach 1991)
================================================================================
A Catalogue of Measured Redshifts of Abell Clusters of Galaxies
    Andernach H.
   <ASP Conf. Ser. 15, 279 (1991)>
   =1991lssp.conf..279A
   =1996yCat.7165....0A
================================================================================
ADC_Keywords: Clusters, galaxy; Redshifts

Description:
    The 'ACO' catalog (Abell, Corwin and Olowin 1989; Cat.  VII/110)  that
    contains 4076  rich (A-)  clusters of  galaxies and 1174 supplementary
    (S-)   clusters was used to compile this catalog.  In the compilation,
    many papers containing  galaxy redshifts  were checked  for positional
    coincidences of objects with  Abell  clusters  (typically  within  one
    Abell  radius).  In a total of 1059 ACO clusters a redshift for one or
    more galaxies were found. These 1059 clusters (records)  are sorted by
    the  R.A.  (B1950)  of their centre.   Each record consists of cluster
    name,  cluster centre equatorial coordinates (B1950),  Abell richness,
    distance,  Bautz-Morgan  class,  the magnitude  of the tenth-brightest
    cluster  member,  cluster measured redshift,  the reference code,  the
    Abell radius,   and the decimal log of  the ratio between measured and
    estimated redshift.

File Summary:
--------------------------------------------------------------------------------
 FileName  Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe        80        .   This file
catalog.dat   46     1059   Measured redshifts of Abell clusters of galaxies
refs.dat      74       45   References
expl.txt      80      114   Original explanation file
--------------------------------------------------------------------------------

See also:
  VII/110 : The "ACO-catalogue"  (Abell+ 1989)
  VII/177 : Redshifts and Vel Dispersions for Abell Clusters (Struble+ 1991)

Byte-by-byte Description of file: catalog.dat
--------------------------------------------------------------------------------
  Bytes  Format  Units     Label    Explanations
--------------------------------------------------------------------------------
   2       A1    ---       Prefix  *[AS] prefix for the cluster name
   3-  6   I4    ---       IDnum    [1,4076] numbering part of the cluster
                                     name
       7   A1    ---     m_IDnum    [=ABCNS] suffix for the cluster name
   8-  9   I2    h         RAh     *[0,24[+= right ascension (hours) (B1950)
  10- 12   I3    0.1min    RAdm    *[0,600[ right ascension (0.1minutes)
      13   A1    ---       DE-       declination sign
  14- 15   I2    deg       DEd     *declination (degrees)     (B1950)
  16- 17   I2    arcmin    DEm     *declination (minutes)
      19   I1    ---       Rich     [0,5] Abell richness class
      20   I1    ---       Dist     [0,7] Abell distance class
      21   I1    ---       BM       [1,5]? Bautz-Morgan class
      22   A1    ---     q_BM       [:?] quality code of BM, as of ACO
  24- 26   I3    0.1mag    m10      magnitude of 10th brightest cluster member
      27   A1    ---     q_z       *[:*!?f] quality code of redshift
  28- 31   I4    10-4      z        [0,] cluster redshift
      32   A1    ---     r_z        [A-Za-z]! reference code in "refs.dat"
  36- 39   I4    0.1arcmin Arad     [0,] Abell radius (=3 Mpc/Ho/50), using
                                     qo=0.10
  41- 46   F6.3 [---]    log(Zm/Ze) The ratio between measured and estimated z
--------------------------------------------------------------------------------
Note on Prefix:
    'A' for rich clusters,
    'S' for ACO extension of poor or distant clusters.
Note on RAh, RAdm, DEd, DEm:
    Right ascension and declination of the cluster center, as of ACO

Note on q_z:
    A blank quality indicates a z measured and within factor 2 of the
    m10-estimate.
    : = z measured and within factor 2 to 4 of the m10-estimate.
    * = z measured but outside the above range. Likely due to foreground or
        background object (rejected for m10-z relation)
    ! = listed redshift is average of very discordant ones, indicating
        possible line-of-sight projection of clusters
        (not used for m10-z relation)
    ? = listed redshift is single peripheral object, concordant within
        factor of 2 from estimate (not used for m10-z relation)
    f = cluster is known from published notes to have foreground galaxies.
        Listed redshift likely due to these objects.
        (rejected for m10-z relation)
    See also the "expl.txt" file.
--------------------------------------------------------------------------------

Byte-by-byte Description of file: refs.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
       1  A1    ---     Ref       Reference  code
       2  A1    ---     ---       [=]
   3- 21  A19   ---     BibCode   19-digit reference code
  23- 74  A52   ---     Text      Original text of reference
--------------------------------------------------------------------------------

Acknowledgments:
  The original "expl.txt" file by H. Andernach (1991) was used to create
  this ReadMe file.

History:
  * 08-Nov-1993: First archived (Koichi Nakajima, CDS)
  * 28-Feb-1994: Removed leading zeroes in Abell numbers, and
                 replaced "expl.txt" by a new one (Koichi Nakajima, CDS)
  * 31-Oct-1996: Standardized ReadMe (C.-H. Lyu, Hughes STX/NASA)
  * 25-Jul-2004: Added refs.dat (Francois Ochsenbein, CDS)
================================================================================
(End) K. Nakajima, H. Andernach [CDS]; C.-H. Lyu [Hughes STX/NASA]   31-Oct-1996
